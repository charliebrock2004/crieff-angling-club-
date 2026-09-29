import "server-only";
import { cache } from "react";
import { sql } from "../db";

export interface Water {
  id: string;
  slug: string;
  name: string;
  kind: "river" | "loch";
  tagline: string | null;
  summary: string | null;
  description: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  accessInfo: string | null;
  parkingInfo: string | null;
  bookingEnabled: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface Beat {
  id: string;
  waterId: string;
  waterSlug: string;
  waterName: string;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  description: string | null;
  lengthDescription: string | null;
  banks: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  latitude: number | null;
  longitude: number | null;
  locationIsApproximate: boolean;
  accessInfo: string | null;
  parkingInfo: string | null;
  boundaries: string | null;
  pointsOfInterest: { name: string; description?: string; lat?: number; lng?: number }[];
  fishingInfo: string | null;
  dailyCapacity: number;
  bookingEnabled: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  species: { slug: string; name: string }[];
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function mapWater(w: Record<string, unknown>): Water {
  return {
    id: w.id as string,
    slug: w.slug as string,
    name: w.name as string,
    kind: w.kind as Water["kind"],
    tagline: w.tagline as string | null,
    summary: w.summary as string | null,
    description: w.description as string | null,
    heroImageUrl: w.hero_image_url as string | null,
    heroImageAlt: w.hero_image_alt as string | null,
    locationName: w.location_name as string | null,
    latitude: n(w.latitude),
    longitude: n(w.longitude),
    accessInfo: w.access_info as string | null,
    parkingInfo: w.parking_info as string | null,
    bookingEnabled: w.booking_enabled as boolean,
    seoTitle: w.seo_title as string | null,
    seoDescription: w.seo_description as string | null,
  };
}

function mapBeat(b: Record<string, unknown>): Beat {
  return {
    id: b.id as string,
    waterId: b.water_id as string,
    waterSlug: b.water_slug as string,
    waterName: b.water_name as string,
    slug: b.slug as string,
    name: b.name as string,
    tagline: b.tagline as string | null,
    summary: b.summary as string | null,
    description: b.description as string | null,
    lengthDescription: b.length_description as string | null,
    banks: b.banks as string | null,
    heroImageUrl: b.hero_image_url as string | null,
    heroImageAlt: b.hero_image_alt as string | null,
    latitude: n(b.latitude),
    longitude: n(b.longitude),
    locationIsApproximate: b.location_is_approximate as boolean,
    accessInfo: b.access_info as string | null,
    parkingInfo: b.parking_info as string | null,
    boundaries: b.boundaries as string | null,
    pointsOfInterest: (b.points_of_interest as Beat["pointsOfInterest"]) ?? [],
    fishingInfo: b.fishing_info as string | null,
    dailyCapacity: b.daily_capacity as number,
    bookingEnabled: b.booking_enabled as boolean,
    seoTitle: b.seo_title as string | null,
    seoDescription: b.seo_description as string | null,
    species: (b.species as Beat["species"]) ?? [],
  };
}

export const getWaters = cache(async (): Promise<Water[]> => {
  const rows = await sql`select * from public.waters where is_published order by sort_order, name`;
  return rows.map(mapWater);
});

export const getWater = cache(async (slug: string): Promise<Water | null> => {
  const [row] = await sql`select * from public.waters where slug = ${slug} and is_published`;
  return row ? mapWater(row) : null;
});

const beatSelect = (where: ReturnType<typeof sql>) => sql`
  select b.*, w.slug as water_slug, w.name as water_name,
    coalesce((select json_agg(json_build_object('slug', s.slug, 'name', s.name) order by s.sort_order)
      from public.beat_species bs join public.species s on s.id = bs.species_id where bs.beat_id = b.id), '[]') as species
  from public.beats b join public.waters w on w.id = b.water_id
  where b.is_published and w.is_published and ${where}
  order by w.sort_order, b.sort_order`;

export const getBeats = cache(async (waterSlug?: string): Promise<Beat[]> => {
  const rows = await beatSelect(waterSlug ? sql`w.slug = ${waterSlug}` : sql`true`);
  return rows.map(mapBeat);
});

export const getBeat = cache(async (slug: string): Promise<Beat | null> => {
  const [row] = await beatSelect(sql`b.slug = ${slug}`);
  return row ? mapBeat(row) : null;
});

export const getSpecies = cache(async () => {
  return sql`select id, slug, name, scientific_name, description from public.species order by sort_order`;
});

export interface SeasonRow {
  id: string;
  name: string;
  speciesSlug: string | null;
  speciesName: string | null;
  waterSlug: string | null;
  waterName: string | null;
  beatName: string | null;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  closedWeekdays: number[];
  description: string | null;
}

export const getSeasons = cache(async (): Promise<SeasonRow[]> => {
  const rows = await sql`
    select fs.*, s.slug as species_slug, s.name as species_name, w.slug as water_slug, w.name as water_name, b.name as beat_name
    from public.fishing_seasons fs
    left join public.species s on s.id = fs.species_id
    left join public.waters w on w.id = fs.water_id
    left join public.beats b on b.id = fs.beat_id
    where fs.is_published order by fs.sort_order, fs.name`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    speciesSlug: r.species_slug,
    speciesName: r.species_name,
    waterSlug: r.water_slug,
    waterName: r.water_name,
    beatName: r.beat_name,
    startMonth: r.start_month,
    startDay: r.start_day,
    endMonth: r.end_month,
    endDay: r.end_day,
    closedWeekdays: r.closed_weekdays.map(Number),
    description: r.description,
  }));
});

export interface PermitTypePublic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  waterSlug: string;
  waterName: string;
  isJunior: boolean;
  requiresBoat: boolean;
  conditions: string | null;
  beats: string[];
  prices: { label: string; pricePence: number; startMonth: number; startDay: number; endMonth: number; endDay: number; closedWeekdays: number[] }[];
}

export const getPermitTypes = cache(async (): Promise<PermitTypePublic[]> => {
  const rows = await sql`
    select p.*, w.slug as water_slug, w.name as water_name,
      coalesce((select array_agg(b.name order by b.sort_order) from public.permit_type_beats pb join public.beats b on b.id = pb.beat_id where pb.permit_type_id = p.id), '{}') as beat_names,
      coalesce((select json_agg(json_build_object('label', pp.label, 'pricePence', pp.price_pence, 'startMonth', pp.start_month, 'startDay', pp.start_day,
        'endMonth', pp.end_month, 'endDay', pp.end_day, 'closedWeekdays', pp.closed_weekdays) order by pp.start_month, pp.start_day)
        from public.permit_prices pp where pp.permit_type_id = p.id and pp.sale_enabled), '[]') as prices
    from public.permit_types p join public.waters w on w.id = p.water_id
    where p.is_active and w.is_published
    order by w.sort_order, p.sort_order`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    waterSlug: r.water_slug,
    waterName: r.water_name,
    isJunior: r.is_junior,
    requiresBoat: r.requires_boat,
    conditions: r.conditions,
    beats: r.beat_names,
    prices: r.prices,
  }));
});

export interface RulePublic {
  id: string;
  category: string;
  title: string;
  body: string;
  waterSlug: string | null;
  beatSlug: string | null;
  beatName: string | null;
  speciesSlug: string | null;
}

export const getRules = cache(async (): Promise<RulePublic[]> => {
  const rows = await sql`
    select r.id, r.category, r.title, r.body, w.slug as water_slug, b.slug as beat_slug, b.name as beat_name, s.slug as species_slug
    from public.rules r
    left join public.waters w on w.id = r.water_id
    left join public.beats b on b.id = r.beat_id
    left join public.species s on s.id = r.species_id
    where r.is_published order by r.category, r.sort_order, r.title`;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    body: r.body,
    waterSlug: r.water_slug,
    beatSlug: r.beat_slug,
    beatName: r.beat_name,
    speciesSlug: r.species_slug,
  }));
});

export const getBoats = cache(async (waterSlug: string) => {
  return sql`
    select bt.name, bt.description, bt.capacity_anglers, bt.hire_price_pence
    from public.boats bt join public.waters w on w.id = bt.water_id
    where w.slug = ${waterSlug} and bt.is_active order by bt.sort_order`;
});

export interface NewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  isFeatured: boolean;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

function mapPost(r: Record<string, unknown>): NewsPost {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    excerpt: r.excerpt as string | null,
    body: r.body as string,
    coverImageUrl: r.cover_image_url as string | null,
    coverImageAlt: r.cover_image_alt as string | null,
    isFeatured: r.is_featured as boolean,
    publishedAt: new Date(r.published_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    seoTitle: r.seo_title as string | null,
    seoDescription: r.seo_description as string | null,
  };
}

export const getNews = cache(async (limit = 50, offset = 0): Promise<NewsPost[]> => {
  const rows = await sql`
    select * from public.news_posts where status = 'published' and published_at <= now()
    order by published_at desc limit ${limit} offset ${offset}`;
  return rows.map(mapPost);
});

export const getNewsPost = cache(async (slug: string): Promise<NewsPost | null> => {
  const [row] = await sql`select * from public.news_posts where slug = ${slug} and status = 'published' and published_at <= now()`;
  return row ? mapPost(row) : null;
});

export interface GalleryImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  waterSlug: string | null;
  beatSlug: string | null;
}

export const getGallery = cache(async (filter: { waterSlug?: string; beatSlug?: string; limit?: number } = {}): Promise<GalleryImage[]> => {
  const rows = await sql`
    select g.*, c.slug as category_slug, c.name as category_name, w.slug as water_slug, b.slug as beat_slug
    from public.gallery_images g
    left join public.gallery_categories c on c.id = g.category_id
    left join public.waters w on w.id = g.water_id
    left join public.beats b on b.id = g.beat_id
    where g.is_published
      and (${filter.waterSlug ?? null}::text is null or w.slug = ${filter.waterSlug ?? null})
      and (${filter.beatSlug ?? null}::text is null or b.slug = ${filter.beatSlug ?? null})
    order by g.sort_order, g.created_at desc
    limit ${filter.limit ?? 200}`;
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    width: r.width,
    height: r.height,
    alt: r.alt,
    caption: r.caption,
    credit: r.credit,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
    waterSlug: r.water_slug,
    beatSlug: r.beat_slug,
  }));
});

export const getGalleryCategories = cache(async () => sql`select slug, name from public.gallery_categories order by sort_order, name`);

export const getMembershipTypes = cache(async () => {
  const rows = await sql`select * from public.membership_types where is_active order by sort_order`;
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: r.description as string | null,
    eligibility: r.eligibility as string | null,
    benefits: r.benefits as string[],
    pricePence: r.price_pence as number,
    joiningFeePence: r.joining_fee_pence as number,
    expiryMonth: r.expiry_month as number,
    expiryDay: r.expiry_day as number,
    onlineApplicationEnabled: r.online_application_enabled as boolean,
  }));
});

export const getPage = cache(async (slug: string) => {
  const [row] = await sql`select * from public.pages where slug = ${slug} and is_published`;
  return row
    ? {
        slug: row.slug as string,
        title: row.title as string,
        intro: row.intro as string | null,
        body: row.body as string,
        seoTitle: row.seo_title as string | null,
        seoDescription: row.seo_description as string | null,
        updatedAt: new Date(row.updated_at).toISOString(),
      }
    : null;
});
