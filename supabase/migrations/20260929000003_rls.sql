-- =============================================================================
-- Row Level Security
-- -----------------------------------------------------------------------------
-- The Next.js server talks to Postgres over a privileged server-only
-- connection (DATABASE_URL) and performs its own authorisation checks.
-- RLS protects everything reachable with the *public* anon key via the
-- Supabase Data API: RLS is enabled on every table, deny-by-default, with
-- narrowly scoped read policies for published content, owner-only policies
-- for an angler's own records, and full access for admins.
-- =============================================================================

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Admin full access on every table.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admin_all_' || t, t);
  end loop;
end $$;

-- Public (published) content -------------------------------------------------
create policy public_read on public.species for select to anon, authenticated using (true);
create policy public_read on public.waters for select to anon, authenticated using (is_published);
create policy public_read on public.water_species for select to anon, authenticated using (true);
create policy public_read on public.beats for select to anon, authenticated using (is_published);
create policy public_read on public.beat_species for select to anon, authenticated using (true);
create policy public_read on public.boats for select to anon, authenticated using (is_active);
create policy public_read on public.fishing_seasons for select to anon, authenticated using (is_published);
create policy public_read on public.permit_types for select to anon, authenticated using (is_active);
create policy public_read on public.permit_type_species for select to anon, authenticated using (true);
create policy public_read on public.permit_type_beats for select to anon, authenticated using (true);
create policy public_read on public.permit_prices for select to anon, authenticated using (sale_enabled);
create policy public_read on public.membership_types for select to anon, authenticated using (is_active);
create policy public_read on public.rules for select to anon, authenticated using (is_published);
create policy public_read on public.news_posts for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy public_read on public.gallery_categories for select to anon, authenticated using (true);
create policy public_read on public.gallery_images for select to anon, authenticated using (is_published);
create policy public_read on public.pages for select to anon, authenticated using (is_published);
create policy public_read on public.settings for select to anon, authenticated using (is_public);

-- An angler's own records ------------------------------------------------------
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());

create policy own_customer on public.customers for select to authenticated using (user_id = auth.uid());

create policy own_bookings on public.bookings for select to authenticated
  using (customer_id in (select c.id from public.customers c where c.user_id = auth.uid()));

create policy own_permits on public.permits for select to authenticated
  using (booking_id in (
    select b.id from public.bookings b join public.customers c on c.id = b.customer_id
    where c.user_id = auth.uid()));

create policy own_memberships on public.memberships for select to authenticated
  using (customer_id in (select c.id from public.customers c where c.user_id = auth.uid()));

create policy own_applications on public.membership_applications for select to authenticated
  using (user_id = auth.uid());

create policy own_catch_returns on public.catch_returns for select to authenticated
  using (user_id = auth.uid());

create policy own_catch_return_items on public.catch_return_items for select to authenticated
  using (catch_return_id in (select r.id from public.catch_returns r where r.user_id = auth.uid()));

-- No insert/update/delete policies exist for anon or ordinary users: every
-- write goes through validated server code. In particular a user can never
-- change their own role, a booking's status or a payment.

-- Supabase Storage bucket for images (only when running on Supabase).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 15728640, array['image/jpeg','image/png','image/webp','image/avif'])
    on conflict (id) do nothing;
  end if;
end $$;
