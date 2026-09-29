-- =============================================================================
-- Crieff Angling Club — seed data
-- -----------------------------------------------------------------------------
-- Built from the information published on the club's old website
-- (crieffanglingclub.org.uk — Prices, Season, River Beats, Drummond Loch,
-- Membership, Rules & Guidance for Anglers PDF, News) and the club's FishPal
-- listing.
--
-- Anything marked needs_confirmation = true is either:
--   * contradictory on the old site (e.g. salmon price £20 vs £25),
--   * missing from the old site and set to a neutral placeholder, or
--   * approximate (map coordinates).
-- These appear with a "Needs confirmation" badge in the admin panel and are
-- listed in docs/PROJECT_NOTES.md. None of them should be treated as official
-- until the committee has checked them.
-- =============================================================================

begin;

-- Species ---------------------------------------------------------------------
insert into public.species (slug, name, scientific_name, description, sort_order) values
  ('salmon', 'Atlantic salmon', 'Salmo salar', 'Salmon may be fished from 1 February to 31 October (no Sundays). All salmon are currently returned.', 1),
  ('sea-trout', 'Sea trout', 'Salmo trutta', 'Sea trout run the Earn through the summer. Fish caught after 31 August must be returned.', 2),
  ('brown-trout', 'Brown trout', 'Salmo trutta', 'Wild brown trout in the river; Drummond Loch is stocked annually with brown trout.', 3),
  ('grayling', 'Grayling', 'Thymallus thymallus', 'Winter grayling fishing on the Drummond Castle water from mid-November to mid-January.', 4);

-- Waters ------------------------------------------------------------------------
insert into public.waters (slug, name, kind, tagline, summary, description, location_name, latitude, longitude, access_info, parking_info, sort_order, seo_title, seo_description, needs_confirmation) values
  ('river-earn', 'River Earn', 'river',
   'Salmon, sea trout, brown trout and grayling on the upper Earn',
   'Crieff Angling Club controls three beats on the upper River Earn — Upper Strowan, Braidhaugh and Drummond Castle — with mostly double-bank fishing for salmon, sea trout, brown trout and grayling.',
   E'The Earn drains Loch Earn at St Fillans and runs east through Comrie and Crieff on its way to the Tay. Around Crieff it is a lively, varied river of streams, glides and deep holding pools.\n\nThe club''s water covers three beats. **Upper Strowan** lies on the Strowan Estate between Comrie and Crieff. **Braidhaugh** is a shorter stretch immediately above Crieff Bridge, and **Drummond Castle** — the club''s longest and most productive beat — runs downstream from the bridge.\n\nVisitor day permits are sold separately for salmon & sea trout, brown trout and grayling, with a limited number of permits per beat each day.',
   'Crieff, Perthshire', 56.372700, -3.840000, null, null, 1,
   'River Earn Fishing at Crieff — Salmon, Sea Trout, Trout & Grayling',
   'Fish three River Earn beats at Crieff, Perthshire: Upper Strowan, Braidhaugh and Drummond Castle. Book salmon, sea trout, brown trout and grayling day permits online.',
   true),
  ('drummond-loch', 'Drummond Loch', 'loch',
   'Fly-only brown trout from the boat, in the grounds of Drummond Castle',
   'An 86-acre Site of Special Scientific Interest within the Drummond Castle Estate. Fly-only brown trout fishing from the club''s boats — there is no bank fishing.',
   E'Drummond Loch sits within the grounds of the Drummond Castle Estate, south of Crieff. It is a Site of Special Scientific Interest of around 86 acres and one of the few remaining brown-trout-only fisheries in Scotland.\n\nThe loch is stocked each year with brown trout, and fish to 4lb are taken, with 2lb fish not uncommon. Fishing is **fly only** and **from the boat only**: the club has three Clansman boats, each comfortably taking three anglers.',
   'Drummond Castle Estate, near Crieff', 56.339000, -3.866000, null,
   'Ample parking in the Bennybeg car park on the opposite side of the road.', 2,
   'Drummond Loch Fishing — Fly-Only Brown Trout near Crieff',
   'Fly-only boat fishing for brown trout on Drummond Loch, an 86-acre SSSI in the Drummond Castle Estate near Crieff. Book a boat and permits online.',
   true);

insert into public.water_species (water_id, species_id)
select w.id, s.id from public.waters w, public.species s
where (w.slug = 'river-earn') or (w.slug = 'drummond-loch' and s.slug = 'brown-trout');

-- Beats -------------------------------------------------------------------------
insert into public.beats (water_id, slug, name, tagline, summary, description, length_description, banks, latitude, longitude, location_is_approximate, fishing_info, daily_capacity, sort_order, seo_title, seo_description, needs_confirmation)
select w.id, v.slug, v.name, v.tagline, v.summary, v.description, v.length_description, v.banks, v.lat, v.lng, true, v.fishing_info, v.capacity, v.sort_order, v.seo_title, v.seo_description, true
from public.waters w
join (values
  ('river-earn', 'upper-strowan', 'Upper Strowan',
   'Estate water between Comrie and Crieff',
   'The Strowan Estate water, upstream of Crieff on the road to Comrie.',
   E'Upper Strowan is the club''s upstream beat, on the Strowan Estate between Comrie and Crieff. The river here is intimate and varied, with a mix of streamy runs and holding pools.\n\nThe beat fishes for salmon and sea trout from February to October and for wild brown trout through the trout season.',
   null, 'Mostly double bank', 56.374000, -3.900000,
   E'Salmon and sea trout: day permits for visitors, limited in number each day.\nBrown trout: separate day permit.',
   4, 1,
   'Upper Strowan Beat — River Earn Fishing near Crieff',
   'Salmon, sea trout and brown trout fishing on the Upper Strowan beat of the River Earn, between Comrie and Crieff. Check availability and book a day permit.'),
  ('river-earn', 'braidhaugh', 'Braidhaugh',
   'A short, accessible stretch just above Crieff Bridge',
   'A shorter stretch of the Earn immediately above Crieff Bridge.',
   E'Braidhaugh is the club''s shortest beat, running immediately above Crieff Bridge. It is close to town and easy to reach, and it can fish well when fresh fish are running.',
   null, 'Mostly double bank', 56.366000, -3.844000,
   E'Salmon and sea trout: day permits for visitors, limited in number each day.\nBrown trout: separate day permit.',
   4, 2,
   'Braidhaugh Beat — River Earn Fishing at Crieff Bridge',
   'Fish the Braidhaugh beat of the River Earn, just above Crieff Bridge. Salmon, sea trout and brown trout day permits available online.'),
  ('river-earn', 'drummond-castle', 'Drummond Castle',
   'The club''s longest and most productive beat, below Crieff Bridge',
   'The more extensive and productive beat, running downstream from Crieff Bridge on the Drummond Castle Estate.',
   E'Drummond Castle is the club''s longest beat and historically its most productive, running downstream from Crieff Bridge through the Drummond Castle Estate.\n\nIt is also the club''s grayling water: from mid-November to mid-January, grayling may be fished here with fly or bait.',
   null, 'Mostly double bank', 56.360000, -3.825000,
   E'Salmon and sea trout: day permits for visitors, limited in number each day.\nBrown trout: separate day permit.\nGrayling (15 November – 15 January): this beat only. No wading or crossing the river in the grayling season.',
   4, 3,
   'Drummond Castle Beat — Salmon, Sea Trout & Grayling Fishing, River Earn',
   'The Drummond Castle beat is the longest club water on the River Earn below Crieff Bridge. Book salmon, sea trout, brown trout and winter grayling permits.'),
  ('drummond-loch', 'drummond-loch', 'Drummond Loch',
   'Boat fishing only',
   'Fly-only boat fishing on Drummond Loch.',
   E'All fishing on Drummond Loch is from the club''s boats. Permits are booked per angler and a boat is allocated automatically — up to three anglers can share a boat.',
   null, null, 56.339000, -3.866000,
   E'Fly only. Boat fishing only — no bank fishing.',
   9, 1,
   'Drummond Loch Boat Fishing',
   'Book a boat on Drummond Loch for fly-only brown trout fishing near Crieff.')
) as v(water_slug, slug, name, tagline, summary, description, length_description, banks, lat, lng, fishing_info, capacity, sort_order, seo_title, seo_description)
  on v.water_slug = w.slug;

insert into public.beat_species (beat_id, species_id)
select b.id, s.id from public.beats b join public.waters w on w.id = b.water_id, public.species s
where (w.slug = 'river-earn' and s.slug in ('salmon', 'sea-trout', 'brown-trout'))
   or (b.slug = 'drummond-castle' and s.slug = 'grayling')
   or (b.slug = 'drummond-loch' and s.slug = 'brown-trout');

-- Boats -------------------------------------------------------------------------
insert into public.boats (water_id, name, description, capacity_anglers, hire_price_pence, sort_order, needs_confirmation)
select w.id, v.name, 'Clansman boat. Comfortably takes three anglers.', 3, 0, v.sort_order, true
from public.waters w, (values ('Boat 1', 1), ('Boat 2', 2), ('Boat 3', 3)) as v(name, sort_order)
where w.slug = 'drummond-loch';

-- Seasons -----------------------------------------------------------------------
insert into public.fishing_seasons (name, species_id, water_id, beat_id, start_month, start_day, end_month, end_day, closed_weekdays, description, sort_order, needs_confirmation)
select v.name, s.id, w.id, b.id, v.sm, v.sd, v.em, v.ed, v.closed::smallint[], v.description, v.sort_order, v.nc
from (values
  ('Salmon', 'salmon', 'river-earn', null, 2, 1, 10, 31, '{0}',
   E'No fishing on Sundays. The Earn is currently a Category 3 river: all salmon and grilse must be returned. (Category status is reviewed annually by the Scottish Government.)', 1, true),
  ('Sea trout', 'sea-trout', 'river-earn', null, 2, 1, 10, 31, '{0}',
   'No fishing on Sundays. Sea trout caught after 31 August must be released alive and recorded on your return.', 2, false),
  ('Brown trout (river)', 'brown-trout', 'river-earn', null, 3, 15, 10, 6, '{}',
   'Wild brown trout on all three River Earn beats.', 3, true),
  ('Brown trout (Drummond Loch)', 'brown-trout', 'drummond-loch', null, 3, 15, 10, 6, '{}',
   'Fly only, from the boat.', 4, false),
  ('Grayling', 'grayling', 'river-earn', 'drummond-castle', 11, 15, 1, 15, '{}',
   'Drummond Castle beat only. Fly and bait permitted. Anglers must not wade or cross the river.', 5, false)
) as v(name, species, water, beat, sm, sd, em, ed, closed, description, sort_order, nc)
join public.species s on s.slug = v.species
join public.waters w on w.slug = v.water
left join public.beats b on b.slug = v.beat;

-- Permit types ------------------------------------------------------------------
insert into public.permit_types (slug, name, description, water_id, season_id, is_junior, max_age, max_per_booking, requires_boat, conditions, sort_order, needs_confirmation)
select v.slug, v.name, v.description, w.id, fs.id, v.is_junior, null, v.max_per_booking, v.requires_boat, v.conditions, v.sort_order, v.nc
from (values
  ('salmon-sea-trout', 'Salmon & Sea Trout — day permit',
   'A visitor day permit for salmon and sea trout on one River Earn beat.',
   'river-earn', 'Salmon', false, 4, false,
   E'No bait fishing before 1 May. All sea trout and hen salmon must be returned after 31 August. No day permits are sold for the last two weeks of October.',
   1, true),
  ('brown-trout-river', 'Brown Trout — day permit',
   'A visitor day permit for brown trout on one River Earn beat.',
   'river-earn', 'Brown trout (river)', false, 4, false, null, 2, true),
  ('brown-trout-river-junior', 'Brown Trout — junior day permit',
   'Junior visitor day permit for brown trout on one River Earn beat. (Junior age limit to be confirmed by the club.)',
   'river-earn', 'Brown trout (river)', true, 4, false, null, 3, true),
  ('grayling', 'Grayling — day permit',
   'A visitor day permit for grayling on the Drummond Castle beat (15 November – 15 January).',
   'river-earn', 'Grayling', false, 4, false,
   'Drummond Castle beat only. Do not wade or cross the river.', 4, true),
  ('grayling-junior', 'Grayling — junior day permit',
   'Junior visitor day permit for grayling on the Drummond Castle beat. (Junior age limit to be confirmed by the club.)',
   'river-earn', 'Grayling', true, 4, false,
   'Drummond Castle beat only. Do not wade or cross the river.', 5, true),
  ('drummond-loch-boat', 'Drummond Loch — boat day permit',
   'Fly-only brown trout fishing from a club boat. Book one permit per angler; up to three anglers share a boat.',
   'drummond-loch', 'Brown trout (Drummond Loch)', false, 3, true,
   'Fly only. Boat fishing only — no bank fishing. Put your completed return in the box at the boat house.',
   6, true)
) as v(slug, name, description, water, season, is_junior, max_per_booking, requires_boat, conditions, sort_order, nc)
join public.waters w on w.slug = v.water
left join public.fishing_seasons fs on fs.name = v.season;

insert into public.permit_type_species (permit_type_id, species_id)
select p.id, s.id from public.permit_types p, public.species s
where (p.slug = 'salmon-sea-trout' and s.slug in ('salmon', 'sea-trout'))
   or (p.slug in ('brown-trout-river', 'brown-trout-river-junior', 'drummond-loch-boat') and s.slug = 'brown-trout')
   or (p.slug in ('grayling', 'grayling-junior') and s.slug = 'grayling');

insert into public.permit_type_beats (permit_type_id, beat_id)
select p.id, b.id from public.permit_types p, public.beats b
where p.slug in ('grayling', 'grayling-junior') and b.slug = 'drummond-castle';

-- Price periods (old-site figures — ALL need confirmation for the current season)
insert into public.permit_prices (permit_type_id, label, start_month, start_day, end_month, end_day, price_pence, closed_weekdays, notes, needs_confirmation)
select p.id, v.label, v.sm, v.sd, v.em, v.ed, v.price, v.closed::smallint[], v.notes, true
from (values
  ('salmon-sea-trout', 'Spring & summer (1 Feb – 31 Jul)', 2, 1, 7, 31, 2500, '{0}',
   'Old site shows both £20 and £25 for this period — confirm.'),
  ('salmon-sea-trout', 'Autumn (1 Aug – 30 Sep)', 8, 1, 9, 30, 3000, '{0}', null),
  ('salmon-sea-trout', 'October (1 – 15 Oct, no Saturdays)', 10, 1, 10, 15, 3000, '{0,6}',
   'No Saturday fishing in October for day permits. No day permits from 16 October (members only).'),
  ('brown-trout-river', 'Trout season', 3, 15, 10, 6, 700, '{}', null),
  ('brown-trout-river-junior', 'Trout season', 3, 15, 10, 6, 300, '{}', null),
  ('grayling', 'Grayling season', 11, 15, 1, 15, 700, '{}', null),
  ('grayling-junior', 'Grayling season', 11, 15, 1, 15, 300, '{}', null),
  ('drummond-loch-boat', 'Loch season', 3, 15, 10, 6, 1000, '{}',
   'Old site: non-members £10 per day. Boat hire charge (if any) is set on each boat.')
) as v(slug, label, sm, sd, em, ed, price, closed, notes)
join public.permit_types p on p.slug = v.slug;

-- Membership --------------------------------------------------------------------
insert into public.membership_types (slug, name, description, eligibility, benefits, price_pence, joining_fee_pence, expiry_month, expiry_day, requires_approval, sort_order, needs_confirmation) values
  ('local', 'Local membership',
   'Full club membership for anglers who live locally.',
   'Open to those who live within 6 miles of Crieff.',
   array['Fishing on all club waters on the River Earn', 'Members-only fishing in the last two weeks of October', 'A vote at the Annual General Meeting'],
   14000, 2000, 12, 31, true, 1, true),
  ('country', 'Country membership',
   'Full club membership for anglers who live outside the local area.',
   'Open to those who do not qualify for local membership.',
   array['Fishing on all club waters on the River Earn', 'Members-only fishing in the last two weeks of October', 'A vote at the Annual General Meeting'],
   19000, 2000, 12, 31, true, 2, true);

-- Rules -------------------------------------------------------------------------
insert into public.rules (category, water_id, beat_id, species_id, title, body, show_at_booking, requires_acknowledgement, sort_order, needs_confirmation)
select v.category::public.rule_category, w.id, b.id, s.id, v.title, v.body, v.at_booking, v.ack, v.sort_order, v.nc
from (values
  ('general', null, null, null, 'Single rod and line',
   'Fishing is by single rod and line, on club waters only.', true, true, 1, false),
  ('general', null, null, null, 'Returns',
   'Every angler must complete a catch return, including blank days. Returns are essential to how the club manages the fishery.', true, false, 2, false),
  ('river_earn', 'river-earn', null, null, 'No Sunday salmon or sea trout fishing',
   'Fishing for salmon and sea trout is not permitted on Sundays.', true, true, 1, false),
  ('river_earn', 'river-earn', null, null, 'No bait before 1 May',
   'There is no bait fishing before 1 May.', true, true, 2, false),
  ('river_earn', 'river-earn', null, null, 'October',
   'No Saturday fishing for day-permit holders in October. No day permits are sold for the last two weeks of October — this period is for members only.', false, false, 3, true),
  ('salmon', 'river-earn', null, 'salmon', 'Salmon must be returned',
   'The River Earn is currently a Category 3 river under the Conservation of Salmon (Scotland) Regulations: all salmon and grilse must be returned alive. After 31 August all hen salmon must be returned in any case.', true, true, 1, true),
  ('salmon', 'river-earn', null, 'sea-trout', 'Sea trout after 31 August',
   'Sea trout caught after 31 August must be released alive and recorded on your catch return.', true, true, 2, false),
  ('trout', 'river-earn', null, 'brown-trout', 'River brown trout season',
   'Brown trout may be fished from 15 March to 6 October.', false, false, 1, false),
  ('grayling', 'river-earn', 'drummond-castle', 'grayling', 'Grayling season and wading',
   'Grayling may be fished with fly or bait from 15 November to 15 January on the Drummond Castle beat only. During this period anglers must not wade or cross the river.', true, true, 1, false),
  ('beat', 'river-earn', null, null, 'Visitor permits per beat',
   'A limited number of visitor day permits is available on each beat each day (currently four).', false, false, 1, true),
  ('drummond_loch', 'drummond-loch', null, null, 'Fly only, from the boat',
   'Fishing on Drummond Loch is fly only and from the club''s boats only. There is no bank fishing.', true, true, 1, false),
  ('drummond_loch', 'drummond-loch', null, null, 'Returns at the boat house',
   'Put your completed permit/return in the box at the boat house before you leave.', true, false, 2, false),
  ('drummond_loch', 'drummond-loch', null, null, 'Site of Special Scientific Interest',
   'Drummond Loch is an SSSI. Please respect the wildlife and the estate, and leave no litter or line behind.', false, false, 3, false),
  ('boat', 'drummond-loch', null, null, 'Anglers per boat',
   'Each boat takes a maximum of three anglers.', true, false, 1, false),
  ('permit_conditions', null, null, null, 'Permit is personal and date-specific',
   'Your permit is valid only for the angler, date, water and beat shown on it and is not transferable.', true, true, 1, true),
  ('permit_conditions', null, null, null, 'Show your permit on request',
   'Carry your permit (on your phone or printed) and show it to any club official or bailiff on request.', true, true, 2, true)
) as v(category, water, beat, species, title, body, at_booking, ack, sort_order, nc)
left join public.waters w on w.slug = v.water
left join public.beats b on b.slug = v.beat
left join public.species s on s.slug = v.species;

-- Settings ----------------------------------------------------------------------
insert into public.settings (key, value, label, description, is_public, needs_confirmation) values
  ('club_name', '"Crieff Angling Club"', 'Club name', null, true, false),
  ('contact_email', 'null', 'Public contact email', 'Shown on the contact page and in emails. The old site only lists a personal address, so this is left blank until the club provides a club address.', true, true),
  ('contact_phone', '"07586 774905"', 'Secretary phone', 'The old site lists 07586 774905 and 01764 656063 for the Secretary, and 07922 267829 elsewhere. Confirm which to publish.', true, true),
  ('contact_address', 'null', 'Postal address', 'Club postal address for correspondence.', true, true),
  ('permit_outlets', '[{"name":"Crieff Visitor Centre (Strowan & Drummond Castle)","phone":"01764 652722","notes":"Garden centre desk, open 7 days, 9am–5pm (per old site)"},{"name":"Braidhaugh Holiday Park (Braidhaugh)","phone":"01764 652951","notes":null}]', 'Other permit outlets', 'Where permits could previously be bought in person. Confirm these are still selling permits.', true, true),
  ('facebook_url', '"https://www.facebook.com/p/Crieff-Angling-Club-61555589173956/"', 'Facebook page', null, true, false),
  ('fishpal_url', '"https://www.fishpal.com/scotland/tay/crieffanglingclub/"', 'FishPal listing', 'The club previously took online bookings via FishPal. Decide whether to keep this listing once online booking is live here.', false, true),
  ('water_level_url', '"https://waterlevels.sepa.org.uk/"', 'River level link', 'SEPA river levels (updated regularly). Link to the specific Earn gauge once chosen.', true, true),
  ('booking_hold_minutes', '30', 'Checkout hold (minutes)', 'How long permits are held while a customer pays. Minimum 30 (Stripe requirement).', false, false),
  ('booking_max_days_ahead', '365', 'Book up to (days ahead)', null, false, false),
  ('booking_same_day_cutoff_hour', '20', 'Same-day booking cut-off (hour, 24h)', 'Online booking for today closes at this hour (UK time).', false, true),
  ('admin_notification_email', 'null', 'New-booking notification email', 'Where new-booking notifications are sent. Falls back to ADMIN_NOTIFICATION_EMAIL.', false, true),
  ('announcement', 'null', 'Site announcement banner', 'Optional short message shown at the top of every page (e.g. river closures).', true, false);

-- Pages -------------------------------------------------------------------------
insert into public.pages (slug, title, intro, body, seo_description, needs_confirmation) values
  ('about', 'About the club',
   'Crieff Angling Club looks after some of the finest fishing on the upper River Earn, and Drummond Loch in the grounds of Drummond Castle.',
   E'## The club\n\nCrieff Angling Club is a members'' club run by volunteers. It controls three beats on the River Earn around Crieff — Upper Strowan, Braidhaugh and Drummond Castle — and the fishing on Drummond Loch.\n\nVisitors are welcome. Day permits are available for salmon and sea trout, brown trout and grayling on the river, and for fly fishing from the boat on Drummond Loch.\n\n## Looking after the river\n\nThe club works with the estates and the wider Earn community to protect wild fish. Catch-and-release of salmon, careful handling and accurate catch returns are central to that.\n\n## Annual General Meeting\n\nThe club''s AGM is usually held in early December. Notice is posted on the news page.',
   'About Crieff Angling Club — a volunteer-run members'' club managing River Earn beats and Drummond Loch near Crieff, Perthshire.', true),
  ('privacy', 'Privacy policy', 'How Crieff Angling Club collects and uses your personal information.',
   E'## Who we are\n\nCrieff Angling Club ("the club") is the data controller for personal information collected through this website.\n\n## What we collect\n\n- **Bookings:** your name, email address, phone number and postal address, the names of anglers on the booking, and the details of the permit.\n- **Payments:** payments are processed by Stripe. We never see or store your card details.\n- **Accounts:** if you create an account, your email address and login details (handled by our authentication provider, Supabase).\n- **Membership applications and catch returns:** the information you enter on those forms.\n\n## Why we use it\n\nTo issue and verify fishing permits, take payment, contact you about your booking, manage membership, keep catch records required for fishery management, and meet our legal obligations.\n\n## Who we share it with\n\nOnly with service providers that run the website on our behalf: Stripe (payments), Supabase (database and accounts), Resend (email) and Vercel (hosting). Catch statistics may be shared in anonymised form with fishery bodies.\n\n## How long we keep it\n\nBooking and payment records are kept for six years for accounting purposes. You can ask us to delete your account at any time.\n\n## Your rights\n\nYou have the right to access, correct or delete your personal information, and to complain to the Information Commissioner''s Office (ico.org.uk). Contact the club secretary to exercise these rights.',
   'Privacy policy for the Crieff Angling Club website and booking system.', true),
  ('terms', 'Terms & conditions', 'The terms that apply when you buy a permit or membership from Crieff Angling Club.',
   E'## Permits\n\nA permit entitles the named angler to fish the water and beat shown, on the date shown, subject to the club rules and any conditions printed on the permit. Permits are personal and cannot be transferred.\n\n## Rules\n\nAll anglers must follow the club rules, the conditions of their permit and the law, including the Conservation of Salmon (Scotland) Regulations. Anglers who break the rules may be asked to leave the water without refund.\n\n## Payment\n\nPrices are shown in pounds sterling and are taken in full at the time of booking. Your booking is confirmed once payment has been received.\n\n## Cancellations and refunds\n\nSee our cancellation policy.\n\n## Safety\n\nFishing, wading and boating carry risk. Anglers fish at their own risk and are responsible for their own safety and equipment.',
   'Terms and conditions for Crieff Angling Club permits and memberships.', true),
  ('cancellation-policy', 'Cancellation policy', 'What happens if you need to cancel, or if the club has to close the water.',
   E'## If you need to cancel\n\nPlease contact the club as soon as possible, quoting your booking reference. Refunds for cancellations made by the angler are at the discretion of the committee.\n\n## If the club closes the water\n\nIf the club has to close a beat or the loch on your booked date, we will contact you and give you a full refund or move your permit to another date.\n\n## River conditions\n\nPermits are not refunded because of river height or weather, unless the club has closed the water. Check the river level before you travel.',
   'Cancellation and refund policy for Crieff Angling Club day permits.', true);

-- News ----------------------------------------------------------------------------
insert into public.news_posts (slug, title, excerpt, body, status, is_featured, published_at) values
  ('welcome-to-the-new-website', 'Welcome to the new club website',
   'You can now check availability and buy River Earn and Drummond Loch permits online, and receive your permit instantly.',
   E'The club has a new website. Visitors can now check live availability for every beat, buy day permits online and receive a digital permit by email straight away.\n\nMembers can submit catch returns online, and anyone can apply for membership.\n\nIf anything doesn''t work as you expect, please let us know through the contact page.',
   'published', true, now());

commit;
