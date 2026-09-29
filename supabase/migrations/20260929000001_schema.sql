-- =============================================================================
-- Crieff Angling Club — core schema
-- -----------------------------------------------------------------------------
-- Conventions
--   * UUID primary keys (gen_random_uuid) except for natural keys.
--   * Money is stored as integer pence. Currency is GBP.
--   * Fishing dates are plain `date` values in Europe/London local time.
--   * Recurring annual ranges (seasons, price periods) are stored as
--     month/day pairs so they roll over every year without admin effort.
--   * `needs_confirmation` marks seed values that were carried over from the
--     old website (or inferred) and still need to be checked by the club.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('angler', 'bailiff', 'admin');
create type public.water_kind as enum ('river', 'loch');
create type public.booking_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type public.booking_source as enum ('online', 'admin', 'phone', 'in_person');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
create type public.payment_kind as enum ('booking', 'membership');
create type public.content_status as enum ('draft', 'published');
create type public.rule_category as enum (
  'general', 'river_earn', 'beat', 'drummond_loch', 'salmon', 'trout', 'grayling', 'boat', 'permit_conditions'
);
create type public.membership_application_status as enum (
  'submitted', 'waiting_list', 'offered', 'paid', 'rejected', 'withdrawn'
);
create type public.membership_status as enum ('pending_payment', 'active', 'expired', 'cancelled');
create type public.email_status as enum ('sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Validates a month/day pair (allows 29 Feb).
create or replace function public.valid_month_day(m int, d int) returns boolean
language sql immutable as $$
  select m between 1 and 12
     and d between 1 and (array[31,29,31,30,31,30,31,31,30,31,30,31])[m]
$$;

-- ---------------------------------------------------------------------------
-- Users / profiles  (auth.users is owned by Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text,
  role public.app_role not null default 'angler',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role) where role <> 'angler';

-- Customers exist independently of logins so that guest checkout works.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  email citext not null check (length(email) between 3 and 254),
  phone text check (phone is null or length(phone) <= 40),
  address_line1 text check (address_line1 is null or length(address_line1) <= 120),
  address_line2 text check (address_line2 is null or length(address_line2) <= 120),
  town text check (town is null or length(town) <= 80),
  postcode text check (postcode is null or length(postcode) <= 12),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_email_key on public.customers (email);
create index customers_user_idx on public.customers (user_id);
create index customers_name_idx on public.customers (lower(last_name), lower(first_name));

-- ---------------------------------------------------------------------------
-- Fishery: species, waters, beats, boats, seasons
-- ---------------------------------------------------------------------------
create table public.species (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  scientific_name text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.waters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  kind public.water_kind not null,
  tagline text,
  summary text,
  description text,
  hero_image_url text,
  hero_image_alt text,
  location_name text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  access_info text,
  parking_info text,
  booking_enabled boolean not null default true,
  is_published boolean not null default true,
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.water_species (
  water_id uuid not null references public.waters (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  primary key (water_id, species_id)
);

create table public.beats (
  id uuid primary key default gen_random_uuid(),
  water_id uuid not null references public.waters (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline text,
  summary text,
  description text,
  length_description text,
  banks text,
  hero_image_url text,
  hero_image_alt text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_is_approximate boolean not null default true,
  access_info text,
  parking_info text,
  boundaries text,
  points_of_interest jsonb not null default '[]'::jsonb check (jsonb_typeof(points_of_interest) = 'array'),
  fishing_info text,
  -- Visitor permits available per day on this beat (old site: 4 per beat per day).
  daily_capacity int not null default 4 check (daily_capacity between 0 and 500),
  booking_enabled boolean not null default true,
  is_published boolean not null default true,
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index beats_water_idx on public.beats (water_id, sort_order);

create table public.beat_species (
  beat_id uuid not null references public.beats (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  primary key (beat_id, species_id)
);

create table public.boats (
  id uuid primary key default gen_random_uuid(),
  water_id uuid not null references public.waters (id) on delete restrict,
  name text not null,
  description text,
  capacity_anglers int not null default 3 check (capacity_anglers between 1 and 10),
  hire_price_pence int not null default 0 check (hire_price_pence >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (water_id, name)
);

create table public.fishing_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species_id uuid references public.species (id) on delete set null,
  water_id uuid references public.waters (id) on delete cascade,
  beat_id uuid references public.beats (id) on delete cascade,
  start_month smallint not null,
  start_day smallint not null,
  end_month smallint not null,
  end_day smallint not null,
  -- 0 = Sunday … 6 = Saturday (JavaScript getDay convention)
  closed_weekdays smallint[] not null default '{}' check (closed_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  description text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.valid_month_day(start_month, start_day)),
  check (public.valid_month_day(end_month, end_day))
);

-- ---------------------------------------------------------------------------
-- Permits & pricing
-- ---------------------------------------------------------------------------
create table public.permit_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  water_id uuid not null references public.waters (id) on delete restrict,
  season_id uuid references public.fishing_seasons (id) on delete set null,
  is_junior boolean not null default false,
  min_age smallint check (min_age is null or min_age between 0 and 120),
  max_age smallint check (max_age is null or max_age between 0 and 120),
  max_per_booking int not null default 4 check (max_per_booking between 1 and 20),
  -- Optional per-beat, per-day cap for this permit type (in addition to beat capacity).
  daily_limit int check (daily_limit is null or daily_limit >= 0),
  requires_boat boolean not null default false,
  conditions text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_age is null or max_age is null or min_age <= max_age)
);
create index permit_types_water_idx on public.permit_types (water_id, sort_order);

create table public.permit_type_species (
  permit_type_id uuid not null references public.permit_types (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  primary key (permit_type_id, species_id)
);

-- Beats a permit is valid on. No rows = every beat on the permit's water.
create table public.permit_type_beats (
  permit_type_id uuid not null references public.permit_types (id) on delete cascade,
  beat_id uuid not null references public.beats (id) on delete cascade,
  primary key (permit_type_id, beat_id)
);

-- Price periods: a permit can only be sold on a date covered by an enabled period.
create table public.permit_prices (
  id uuid primary key default gen_random_uuid(),
  permit_type_id uuid not null references public.permit_types (id) on delete cascade,
  label text not null,
  start_month smallint not null,
  start_day smallint not null,
  end_month smallint not null,
  end_day smallint not null,
  price_pence int not null check (price_pence between 0 and 1000000),
  closed_weekdays smallint[] not null default '{}' check (closed_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  sale_enabled boolean not null default true,
  notes text,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.valid_month_day(start_month, start_day)),
  check (public.valid_month_day(end_month, end_day))
);
create index permit_prices_type_idx on public.permit_prices (permit_type_id);

-- ---------------------------------------------------------------------------
-- Availability overrides: blocked dates, special capacities
--   scope: beat_id set  -> that beat
--          water_id set -> every beat on the water
--          neither      -> whole club
--   permit_type_id optionally narrows a block to one permit type.
-- ---------------------------------------------------------------------------
create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  water_id uuid references public.waters (id) on delete cascade,
  beat_id uuid references public.beats (id) on delete cascade,
  permit_type_id uuid references public.permit_types (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  is_blocked boolean not null default false,
  capacity int check (capacity is null or capacity between 0 and 500),
  reason text,
  public_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 400),
  check (is_blocked or capacity is not null),
  check (capacity is null or permit_type_id is null)
);
create index availability_overrides_dates_idx on public.availability_overrides (start_date, end_date);
create index availability_overrides_beat_idx on public.availability_overrides (beat_id);

-- ---------------------------------------------------------------------------
-- Bookings, permits, payments
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Z0-9-]{6,20}$'),
  -- Secret used in customer links (permit view, PDF, cancellation). Never shown to bailiffs.
  access_token text not null unique check (length(access_token) >= 32),
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- Contact details exactly as entered for this booking (the customer record
  -- is shared by email and is never overwritten by an unauthenticated checkout).
  contact jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  water_id uuid not null references public.waters (id) on delete restrict,
  beat_id uuid not null references public.beats (id) on delete restrict,
  permit_type_id uuid not null references public.permit_types (id) on delete restrict,
  permit_price_id uuid references public.permit_prices (id) on delete set null,
  fishing_date date not null,
  quantity int not null check (quantity between 1 and 20),
  unit_price_pence int not null check (unit_price_pence >= 0),
  boat_fee_pence int not null default 0 check (boat_fee_pence >= 0),
  total_pence int not null check (total_pence >= 0),
  currency text not null default 'gbp' check (currency = 'gbp'),
  status public.booking_status not null default 'pending',
  source public.booking_source not null default 'online',
  hold_expires_at timestamptz,
  capacity_override boolean not null default false,
  rules_acknowledged_at timestamptz,
  rules_acknowledged jsonb not null default '[]'::jsonb,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  refunded_at timestamptz,
  amount_refunded_pence int not null default 0 check (amount_refunded_pence >= 0),
  -- Notification claims: set atomically before sending so each email goes once.
  confirmation_sent_at timestamptz,
  admin_notified_at timestamptz,
  cancellation_notified_at timestamptz,
  refund_notified_at timestamptz,
  needs_attention text,
  admin_notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_pence = unit_price_pence * quantity + boat_fee_pence),
  check (amount_refunded_pence <= total_pence),
  check (status <> 'pending' or hold_expires_at is not null),
  check (status <> 'paid' or paid_at is not null)
);
create index bookings_beat_date_idx on public.bookings (beat_id, fishing_date) where status in ('pending', 'paid');
create index bookings_date_idx on public.bookings (fishing_date);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_status_idx on public.bookings (status, created_at desc);
create index bookings_created_idx on public.bookings (created_at desc);

create table public.permits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  permit_number text not null unique,
  -- Random code printed in the QR; used by /permit/verify/<code>.
  verification_code text not null unique check (verification_code ~ '^[A-Z0-9]{10,32}$'),
  angler_first_name text not null check (length(angler_first_name) between 1 and 80),
  angler_last_name text not null check (length(angler_last_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index permits_booking_idx on public.permits (booking_id);

create table public.boat_bookings (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  fishing_date date not null,
  anglers int not null check (anglers >= 1),
  released_at timestamptz,
  created_at timestamptz not null default now()
);
-- A boat can only be held by one live booking per day. Enforced by the database.
create unique index boat_bookings_one_per_day on public.boat_bookings (boat_id, fishing_date) where released_at is null;
create index boat_bookings_booking_idx on public.boat_bookings (booking_id);

create table public.membership_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  eligibility text,
  benefits text[] not null default '{}',
  price_pence int not null check (price_pence >= 0),
  joining_fee_pence int not null default 0 check (joining_fee_pence >= 0),
  -- Memberships expire on this month/day (next occurrence after purchase).
  expiry_month smallint not null default 12,
  expiry_day smallint not null default 31,
  requires_approval boolean not null default true,
  online_application_enabled boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.valid_month_day(expiry_month, expiry_day))
);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  access_token text not null unique check (length(access_token) >= 32),
  membership_type_id uuid not null references public.membership_types (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email citext not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  town text not null,
  postcode text not null,
  date_of_birth date,
  is_renewal boolean not null default false,
  statement text check (statement is null or length(statement) <= 2000),
  status public.membership_application_status not null default 'submitted',
  admin_notes text,
  include_joining_fee boolean not null default true,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  offered_at timestamptz,
  paid_at timestamptz,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_applications_status_idx on public.membership_applications (status, created_at);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  membership_number text not null unique,
  membership_type_id uuid not null references public.membership_types (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  application_id uuid references public.membership_applications (id) on delete set null,
  starts_on date not null,
  expires_on date not null,
  status public.membership_status not null default 'pending_payment',
  amount_paid_pence int not null default 0 check (amount_paid_pence >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on >= starts_on)
);
create index memberships_customer_idx on public.memberships (customer_id);
create index memberships_status_idx on public.memberships (status, expires_on);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind public.payment_kind not null,
  booking_id uuid references public.bookings (id) on delete restrict,
  membership_application_id uuid references public.membership_applications (id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_pence int not null check (amount_pence >= 0),
  amount_refunded_pence int not null default 0 check (amount_refunded_pence >= 0),
  currency text not null default 'gbp',
  status public.payment_status not null default 'pending',
  method text not null default 'stripe',
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'booking' and booking_id is not null and membership_application_id is null)
      or (kind = 'membership' and membership_application_id is not null and booking_id is null)),
  check (amount_refunded_pence <= amount_pence)
);
create index payments_booking_idx on public.payments (booking_id);
create index payments_membership_idx on public.payments (membership_application_id);
create index payments_intent_idx on public.payments (stripe_payment_intent_id);

-- Every Stripe webhook event is recorded exactly once (idempotency).
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- ---------------------------------------------------------------------------
-- Catch returns
-- ---------------------------------------------------------------------------
create table public.catch_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  angler_name text not null check (length(angler_name) between 1 and 160),
  email citext not null,
  is_member boolean not null default false,
  fishing_date date not null,
  water_id uuid not null references public.waters (id) on delete restrict,
  beat_id uuid references public.beats (id) on delete restrict,
  hours_fished numeric(4,1) check (hours_fished is null or hours_fished between 0 and 24),
  is_blank boolean not null default false,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index catch_returns_date_idx on public.catch_returns (fishing_date desc);
create index catch_returns_user_idx on public.catch_returns (user_id);

create table public.catch_return_items (
  id uuid primary key default gen_random_uuid(),
  catch_return_id uuid not null references public.catch_returns (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete restrict,
  quantity int not null check (quantity between 1 and 200),
  weight_lb numeric(5,2) check (weight_lb is null or weight_lb between 0 and 100),
  length_in numeric(5,1) check (length_in is null or length_in between 0 and 70),
  method text check (method is null or length(method) <= 80),
  released boolean not null default true,
  notes text check (notes is null or length(notes) <= 500)
);
create index catch_return_items_return_idx on public.catch_return_items (catch_return_id);

-- ---------------------------------------------------------------------------
-- Content: rules, news, gallery, pages, settings
-- ---------------------------------------------------------------------------
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  category public.rule_category not null,
  water_id uuid references public.waters (id) on delete cascade,
  beat_id uuid references public.beats (id) on delete cascade,
  species_id uuid references public.species (id) on delete cascade,
  title text not null,
  body text not null,
  show_at_booking boolean not null default false,
  requires_acknowledgement boolean not null default false,
  is_published boolean not null default true,
  sort_order int not null default 0,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rules_category_idx on public.rules (category, sort_order);

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  excerpt text,
  body text not null default '',
  cover_image_url text,
  cover_image_alt text,
  status public.content_status not null default 'draft',
  is_featured boolean not null default false,
  published_at timestamptz,
  author_id uuid references auth.users (id) on delete set null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index news_posts_published_idx on public.news_posts (status, published_at desc);

create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.gallery_categories (id) on delete set null,
  water_id uuid references public.waters (id) on delete set null,
  beat_id uuid references public.beats (id) on delete set null,
  storage_path text not null unique,
  url text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  alt text not null default '',
  caption text,
  credit text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_images_sort_idx on public.gallery_images (sort_order, created_at);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  intro text,
  body text not null default '',
  is_published boolean not null default true,
  seo_title text,
  seo_description text,
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  label text,
  description text,
  is_public boolean not null default true,
  needs_confirmation boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email citext not null,
  phone text,
  subject text not null check (length(subject) between 1 and 160),
  message text not null check (length(message) between 1 and 5000),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Operational: verifications, audit, email log, rate limiting
-- ---------------------------------------------------------------------------
create table public.permit_verifications (
  id uuid primary key default gen_random_uuid(),
  permit_id uuid references public.permits (id) on delete set null,
  code text not null,
  result text not null,
  verified_by uuid references auth.users (id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index permit_verifications_permit_idx on public.permit_verifications (permit_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  subject text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  membership_application_id uuid references public.membership_applications (id) on delete set null,
  status public.email_status not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_logs_booking_idx on public.email_logs (booking_id, created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','species','waters','beats','boats','fishing_seasons','permit_types',
    'permit_prices','availability_overrides','bookings','permits','membership_types',
    'membership_applications','memberships','payments','rules','news_posts','gallery_categories',
    'gallery_images','pages'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
