-- =============================================================================
-- Booking integrity, auth helpers and utility functions
-- =============================================================================

-- A booking consumes availability while it is paid, or while it is pending and
-- its checkout hold has not expired. Abandoned / failed / cancelled / refunded
-- bookings never consume availability.
create or replace function public.booking_is_active(p_status public.booking_status, p_hold_expires_at timestamptz)
returns boolean language sql stable as $$
  select p_status = 'paid' or (p_status = 'pending' and p_hold_expires_at > now())
$$;

-- True if the beat is blocked on the date (beat-, water- or club-wide block;
-- optionally only for one permit type).
create or replace function public.is_beat_blocked(p_beat uuid, p_date date, p_permit_type uuid default null)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.availability_overrides o
    join public.beats b on b.id = p_beat
    where o.is_blocked
      and p_date between o.start_date and o.end_date
      and (o.beat_id = b.id or (o.beat_id is null and (o.water_id = b.water_id or o.water_id is null)))
      and (o.permit_type_id is null or o.permit_type_id = p_permit_type)
  )
$$;

-- Effective number of visitor permits available on a beat for a date.
-- Most specific capacity override wins (beat > water > club, newest first);
-- otherwise the beat's default daily capacity. Blocked => 0.
create or replace function public.effective_capacity(p_beat uuid, p_date date, p_permit_type uuid default null)
returns int language plpgsql stable as $$
declare
  v_default int;
  v_water uuid;
  v_override int;
begin
  select daily_capacity, water_id into v_default, v_water from public.beats where id = p_beat;
  if not found then
    return 0;
  end if;
  if public.is_beat_blocked(p_beat, p_date, p_permit_type) then
    return 0;
  end if;
  select o.capacity into v_override
  from public.availability_overrides o
  where not o.is_blocked
    and o.capacity is not null
    and p_date between o.start_date and o.end_date
    and (o.beat_id = p_beat or (o.beat_id is null and (o.water_id = v_water or o.water_id is null)))
  order by (o.beat_id is not null) desc, (o.water_id is not null) desc, o.created_at desc
  limit 1;
  return coalesce(v_override, v_default);
end $$;

create or replace function public.booked_quantity(p_beat uuid, p_date date, p_permit_type uuid default null, p_exclude uuid default null)
returns int language sql stable as $$
  select coalesce(sum(b.quantity), 0)::int
  from public.bookings b
  where b.beat_id = p_beat
    and b.fishing_date = p_date
    and public.booking_is_active(b.status, b.hold_expires_at)
    and (p_permit_type is null or b.permit_type_id = p_permit_type)
    and (p_exclude is null or b.id <> p_exclude)
$$;

-- Serialise all capacity decisions for one beat/day. Transaction-scoped.
create or replace function public.lock_beat_day(p_beat uuid, p_date date)
returns void language sql as $$
  select pg_advisory_xact_lock(hashtextextended(p_beat::text || ':' || p_date::text, 42))
$$;

-- -----------------------------------------------------------------------------
-- Last line of defence against overbooking. Whatever code path writes a
-- booking (online checkout, admin manual booking, edits), the database refuses
-- to let active bookings exceed capacity. Errors:
--   CA001  beat capacity exceeded (or beat blocked)
--   CA002  permit-type daily limit exceeded
-- -----------------------------------------------------------------------------
create or replace function public.enforce_booking_capacity()
returns trigger language plpgsql as $$
declare
  v_capacity int;
  v_used int;
  v_limit int;
  v_used_type int;
begin
  if new.capacity_override then
    return new;
  end if;

  if not public.booking_is_active(new.status, new.hold_expires_at) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Completing payment on a held booking never re-checks capacity: the
    -- hold reserved the space and money may already have been taken.
    if old.status = 'pending' and new.status = 'paid'
       and old.beat_id = new.beat_id and old.fishing_date = new.fishing_date
       and old.permit_type_id = new.permit_type_id and new.quantity <= old.quantity then
      return new;
    end if;
    -- Already active and not consuming more of the same beat/day.
    if public.booking_is_active(old.status, old.hold_expires_at)
       and old.beat_id = new.beat_id and old.fishing_date = new.fishing_date
       and old.permit_type_id = new.permit_type_id and new.quantity <= old.quantity then
      return new;
    end if;
  end if;

  perform public.lock_beat_day(new.beat_id, new.fishing_date);

  v_capacity := public.effective_capacity(new.beat_id, new.fishing_date, new.permit_type_id);
  v_used := public.booked_quantity(new.beat_id, new.fishing_date, null, new.id);
  if v_used + new.quantity > v_capacity then
    raise exception 'CAPACITY_EXCEEDED'
      using errcode = 'CA001',
            detail = format('capacity=%s used=%s requested=%s', v_capacity, v_used, new.quantity);
  end if;

  select daily_limit into v_limit from public.permit_types where id = new.permit_type_id;
  if v_limit is not null then
    v_used_type := public.booked_quantity(new.beat_id, new.fishing_date, new.permit_type_id, new.id);
    if v_used_type + new.quantity > v_limit then
      raise exception 'PERMIT_LIMIT_EXCEEDED'
        using errcode = 'CA002',
              detail = format('limit=%s used=%s requested=%s', v_limit, v_used_type, new.quantity);
    end if;
  end if;

  return new;
end $$;

create trigger bookings_enforce_capacity
  before insert or update of status, quantity, fishing_date, beat_id, permit_type_id, hold_expires_at, capacity_override
  on public.bookings
  for each row execute function public.enforce_booking_capacity();

-- Boat holds are released automatically when a booking stops being live.
create or replace function public.release_boats_for_inactive_booking()
returns trigger language plpgsql as $$
begin
  if new.status in ('failed', 'cancelled', 'refunded') and old.status is distinct from new.status then
    update public.boat_bookings set released_at = now()
    where booking_id = new.id and released_at is null;
  end if;
  return new;
end $$;

create trigger bookings_release_boats
  after update of status on public.bookings
  for each row execute function public.release_boats_for_inactive_booking();

-- A boat held by a *pending* booking whose checkout hold has expired is free.
-- Called before allocating boats so expired holds don't block the unique index.
create or replace function public.release_expired_boat_holds(p_water uuid, p_date date)
returns void language sql as $$
  update public.boat_bookings bb
     set released_at = now()
    from public.bookings b, public.boats bt
   where bb.booking_id = b.id
     and bb.boat_id = bt.id
     and bt.water_id = p_water
     and bb.fishing_date = p_date
     and bb.released_at is null
     and b.status = 'pending'
     and b.hold_expires_at <= now()
$$;

-- -----------------------------------------------------------------------------
-- Auth helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_role_is(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = p_role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_is('admin')
$$;

-- Create a profile for every new auth user. Customers with the same email are
-- only linked once the address has been confirmed, so an unverified sign-up
-- can never see someone else's bookings.
create or replace function public.handle_auth_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null then
    update public.customers set user_id = new.id
    where email = new.email and user_id is null;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_change();

create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_change();

-- -----------------------------------------------------------------------------
-- Fixed-window rate limiter. Returns true if the call is allowed.
-- -----------------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end $$;

-- Human-friendly sequential numbers for permits / memberships.
create sequence public.permit_number_seq start 1001;
create sequence public.membership_number_seq start 101;
