/**
 * Declarative admin resources. Column and table names here are trusted,
 * server-side constants — user input only ever reaches SQL as bound values.
 */
export type Option = { value: string; label: string };

type Base = { name: string; label: string; help?: string; required?: boolean; section?: string; wide?: boolean };
export type Field =
  | (Base & { type: "text" | "textarea" | "markdown" | "slug" | "email" | "url"; max?: number; placeholder?: string })
  | (Base & { type: "number"; min?: number; max?: number; step?: number; nullable?: boolean })
  | (Base & { type: "money"; nullable?: boolean })
  | (Base & { type: "boolean" })
  | (Base & { type: "date" | "datetime"; nullable?: boolean })
  | (Base & { type: "select"; options: Option[]; nullable?: boolean })
  | (Base & { type: "relation"; source: RelationSource; nullable?: boolean })
  | (Base & { type: "monthday"; monthCol: string; dayCol: string })
  | (Base & { type: "weekdays" })
  | (Base & { type: "lines" })
  | (Base & { type: "points" })
  | (Base & { type: "image"; altField?: string; folder: string })
  | (Base & { type: "multi"; joinTable: string; fk: string; otherFk: string; source: RelationSource });

export type RelationSource = "waters" | "beats" | "species" | "permit_types" | "seasons" | "gallery_categories" | "membership_types";

export interface Resource {
  key: string;
  table: string;
  singular: string;
  plural: string;
  description?: string;
  fields: Field[];
  list: { label: string; field: string; format?: "money" | "bool" | "monthday" | "date" | "status" }[];
  orderBy: string;
  titleField: string;
  publicPath?: (row: Record<string, unknown>) => string | null;
  children?: { resource: string; fk: string; title: string }[];
  /** Hide from the admin index (managed from a parent). */
  nested?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  hasNeedsConfirmation?: boolean;
}

const MONTH_OPTIONS: Option[] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({ value: String(i + 1), label: m }));
export { MONTH_OPTIONS };

const seo: Field[] = [
  { name: "seo_title", label: "SEO title", type: "text", max: 70, section: "Search engines", help: "Shown in Google results and browser tabs. Leave blank to use a sensible default." },
  { name: "seo_description", label: "SEO description", type: "textarea", max: 170, section: "Search engines", help: "One or two sentences, about 150 characters." },
];

export const RESOURCES: Record<string, Resource> = {
  waters: {
    key: "waters",
    table: "waters",
    singular: "Water",
    plural: "Waters",
    description: "The fisheries the club controls. Each water has one or more beats.",
    titleField: "name",
    orderBy: "sort_order, name",
    hasNeedsConfirmation: true,
    publicPath: (r) => `/${r.slug}`,
    list: [
      { label: "Name", field: "name" },
      { label: "Type", field: "kind" },
      { label: "Bookable", field: "booking_enabled", format: "bool" },
      { label: "Published", field: "is_published", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, section: "Basics" },
      { name: "slug", label: "Web address", type: "slug", required: true, section: "Basics", help: "Used in the URL, e.g. river-earn. Changing it breaks existing links." },
      { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "river", label: "River" }, { value: "loch", label: "Loch" }], section: "Basics" },
      { name: "tagline", label: "Tagline", type: "text", max: 160, section: "Basics" },
      { name: "summary", label: "Summary", type: "textarea", section: "Basics", help: "Short introduction used on cards and the homepage." },
      { name: "description", label: "Full description", type: "markdown", section: "Basics" },
      { name: "hero_image_url", label: "Hero photograph", type: "image", folder: "waters", altField: "hero_image_alt", section: "Photograph" },
      { name: "location_name", label: "Location name", type: "text", section: "Location & access" },
      { name: "latitude", label: "Latitude", type: "number", step: 0.000001, nullable: true, section: "Location & access" },
      { name: "longitude", label: "Longitude", type: "number", step: 0.000001, nullable: true, section: "Location & access" },
      { name: "access_info", label: "Access", type: "textarea", section: "Location & access" },
      { name: "parking_info", label: "Parking", type: "textarea", section: "Location & access" },
      { name: "booking_enabled", label: "Online booking open", type: "boolean", section: "Settings" },
      { name: "is_published", label: "Show on website", type: "boolean", section: "Settings" },
      { name: "sort_order", label: "Display order", type: "number", section: "Settings" },
      ...seo,
    ],
  },
  beats: {
    key: "beats",
    table: "beats",
    singular: "Beat",
    plural: "Beats",
    description: "Individual stretches of water. Capacity is the number of visitor permits available each day.",
    titleField: "name",
    orderBy: "water_id, sort_order, name",
    hasNeedsConfirmation: true,
    publicPath: (r) => (r.water_slug === "river-earn" ? `/river-earn/${r.slug}` : `/${r.water_slug}`),
    list: [
      { label: "Name", field: "name" },
      { label: "Water", field: "water_name" },
      { label: "Permits / day", field: "daily_capacity" },
      { label: "Bookable", field: "booking_enabled", format: "bool" },
      { label: "Published", field: "is_published", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, section: "Basics" },
      { name: "slug", label: "Web address", type: "slug", required: true, section: "Basics" },
      { name: "water_id", label: "Water", type: "relation", source: "waters", required: true, section: "Basics" },
      { name: "tagline", label: "Tagline", type: "text", max: 160, section: "Basics" },
      { name: "summary", label: "Summary", type: "textarea", section: "Basics" },
      { name: "description", label: "Description", type: "markdown", section: "Basics" },
      { name: "fishing_info", label: "Fishing information", type: "textarea", section: "Basics", help: "One point per line." },
      { name: "length_description", label: "Length", type: "text", section: "Basics", placeholder: "e.g. 2.7 miles" },
      { name: "banks", label: "Banks", type: "text", section: "Basics", placeholder: "e.g. Double bank" },
      { name: "species", label: "Species", type: "multi", joinTable: "beat_species", fk: "beat_id", otherFk: "species_id", source: "species", section: "Basics" },
      { name: "daily_capacity", label: "Visitor permits per day", type: "number", min: 0, max: 500, required: true, section: "Booking", help: "Default daily limit. Change individual dates under Availability." },
      { name: "booking_enabled", label: "Online booking open", type: "boolean", section: "Booking" },
      { name: "is_published", label: "Show on website", type: "boolean", section: "Booking" },
      { name: "sort_order", label: "Display order", type: "number", section: "Booking" },
      { name: "hero_image_url", label: "Hero photograph", type: "image", folder: "beats", altField: "hero_image_alt", section: "Photograph" },
      { name: "latitude", label: "Latitude", type: "number", step: 0.000001, nullable: true, section: "Map & access" },
      { name: "longitude", label: "Longitude", type: "number", step: 0.000001, nullable: true, section: "Map & access" },
      { name: "location_is_approximate", label: "Map position is approximate", type: "boolean", section: "Map & access" },
      { name: "access_info", label: "Access", type: "textarea", section: "Map & access" },
      { name: "parking_info", label: "Parking", type: "textarea", section: "Map & access" },
      { name: "boundaries", label: "Boundaries", type: "textarea", section: "Map & access" },
      { name: "points_of_interest", label: "Points of interest", type: "points", section: "Map & access", help: "One per line: Name | description" },
      ...seo,
    ],
  },
  species: {
    key: "species",
    table: "species",
    singular: "Species",
    plural: "Species",
    titleField: "name",
    orderBy: "sort_order, name",
    list: [{ label: "Name", field: "name" }, { label: "Scientific name", field: "scientific_name" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Web address", type: "slug", required: true },
      { name: "scientific_name", label: "Scientific name", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  seasons: {
    key: "seasons",
    table: "fishing_seasons",
    singular: "Fishing season",
    plural: "Fishing seasons",
    description: "Seasons repeat every year. Permits linked to a season can only be sold within it.",
    titleField: "name",
    orderBy: "sort_order, name",
    hasNeedsConfirmation: true,
    list: [
      { label: "Name", field: "name" },
      { label: "Opens", field: "start", format: "monthday" },
      { label: "Closes", field: "end", format: "monthday" },
      { label: "Published", field: "is_published", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "species_id", label: "Species", type: "relation", source: "species", nullable: true },
      { name: "water_id", label: "Water", type: "relation", source: "waters", nullable: true },
      { name: "beat_id", label: "Beat (if only one)", type: "relation", source: "beats", nullable: true },
      { name: "start", label: "Opens", type: "monthday", monthCol: "start_month", dayCol: "start_day", required: true },
      { name: "end", label: "Closes", type: "monthday", monthCol: "end_month", dayCol: "end_day", required: true, help: "May be earlier than the opening date for seasons that run over New Year." },
      { name: "closed_weekdays", label: "No fishing on", type: "weekdays" },
      { name: "description", label: "Notes shown to anglers", type: "textarea" },
      { name: "is_published", label: "Show on website", type: "boolean" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  "permit-types": {
    key: "permit-types",
    table: "permit_types",
    singular: "Permit type",
    plural: "Permit types",
    description: "What visitors can buy. Prices are set per period below each permit.",
    titleField: "name",
    orderBy: "water_id, sort_order, name",
    hasNeedsConfirmation: true,
    children: [{ resource: "permit-prices", fk: "permit_type_id", title: "Prices & sale periods" }],
    list: [
      { label: "Name", field: "name" },
      { label: "Water", field: "water_name" },
      { label: "Max / booking", field: "max_per_booking" },
      { label: "Active", field: "is_active", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, section: "Basics" },
      { name: "slug", label: "Code", type: "slug", required: true, section: "Basics" },
      { name: "description", label: "Description", type: "textarea", section: "Basics" },
      { name: "water_id", label: "Water", type: "relation", source: "waters", required: true, section: "Basics" },
      { name: "beats", label: "Valid on beats", type: "multi", joinTable: "permit_type_beats", fk: "permit_type_id", otherFk: "beat_id", source: "beats", section: "Basics", help: "Leave all unticked for every beat on the water." },
      { name: "species", label: "Species", type: "multi", joinTable: "permit_type_species", fk: "permit_type_id", otherFk: "species_id", source: "species", section: "Basics" },
      { name: "season_id", label: "Only within season", type: "relation", source: "seasons", nullable: true, section: "Rules" },
      { name: "max_per_booking", label: "Maximum per booking", type: "number", min: 1, max: 20, required: true, section: "Rules" },
      { name: "daily_limit", label: "Daily limit per beat for this permit", type: "number", min: 0, nullable: true, section: "Rules", help: "Optional extra cap, on top of the beat's daily capacity." },
      { name: "is_junior", label: "Junior permit", type: "boolean", section: "Rules" },
      { name: "min_age", label: "Minimum age", type: "number", min: 0, max: 120, nullable: true, section: "Rules" },
      { name: "max_age", label: "Maximum age", type: "number", min: 0, max: 120, nullable: true, section: "Rules" },
      { name: "requires_boat", label: "Needs a boat (loch)", type: "boolean", section: "Rules" },
      { name: "conditions", label: "Permit conditions", type: "textarea", section: "Rules", help: "Printed on the permit and shown before payment. One per line." },
      { name: "is_active", label: "On sale", type: "boolean", section: "Rules" },
      { name: "sort_order", label: "Display order", type: "number", section: "Rules" },
    ],
  },
  "permit-prices": {
    key: "permit-prices",
    table: "permit_prices",
    singular: "Price period",
    plural: "Price periods",
    nested: true,
    titleField: "label",
    orderBy: "start_month, start_day",
    hasNeedsConfirmation: true,
    list: [
      { label: "Period", field: "label" },
      { label: "From", field: "start", format: "monthday" },
      { label: "To", field: "end", format: "monthday" },
      { label: "Price", field: "price_pence", format: "money" },
      { label: "On sale", field: "sale_enabled", format: "bool" },
    ],
    fields: [
      { name: "permit_type_id", label: "Permit type", type: "relation", source: "permit_types", required: true },
      { name: "label", label: "Label", type: "text", required: true, placeholder: "e.g. Autumn (1 Aug – 30 Sep)" },
      { name: "start", label: "From", type: "monthday", monthCol: "start_month", dayCol: "start_day", required: true },
      { name: "end", label: "To", type: "monthday", monthCol: "end_month", dayCol: "end_day", required: true },
      { name: "price_pence", label: "Price per angler per day", type: "money", required: true },
      { name: "closed_weekdays", label: "Not sold on", type: "weekdays" },
      { name: "sale_enabled", label: "On sale", type: "boolean" },
      { name: "notes", label: "Internal notes", type: "textarea" },
    ],
  },
  boats: {
    key: "boats",
    table: "boats",
    singular: "Boat",
    plural: "Boats",
    description: "Each loch booking is allocated one free boat automatically. A boat can never be double-booked.",
    titleField: "name",
    orderBy: "water_id, sort_order, name",
    hasNeedsConfirmation: true,
    list: [
      { label: "Name", field: "name" },
      { label: "Water", field: "water_name" },
      { label: "Anglers", field: "capacity_anglers" },
      { label: "Hire charge", field: "hire_price_pence", format: "money" },
      { label: "In use", field: "is_active", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "water_id", label: "Water", type: "relation", source: "waters", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "capacity_anglers", label: "Maximum anglers", type: "number", min: 1, max: 10, required: true },
      { name: "hire_price_pence", label: "Boat hire charge (per booking)", type: "money", required: true, help: "Added once per booking, on top of permits. £0 if included." },
      { name: "is_active", label: "Available for booking", type: "boolean", help: "Untick if the boat is out of service." },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  rules: {
    key: "rules",
    table: "rules",
    singular: "Rule",
    plural: "Rules",
    description: "Rules marked “show at booking” appear when a matching permit is booked; “must accept” rules must be ticked before payment.",
    titleField: "title",
    orderBy: "category, sort_order, title",
    hasNeedsConfirmation: true,
    list: [
      { label: "Rule", field: "title" },
      { label: "Category", field: "category" },
      { label: "At booking", field: "show_at_booking", format: "bool" },
      { label: "Must accept", field: "requires_acknowledgement", format: "bool" },
      { label: "Published", field: "is_published", format: "bool" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Rule", type: "textarea", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: [
          { value: "general", label: "General" },
          { value: "river_earn", label: "River Earn" },
          { value: "beat", label: "Beat-specific" },
          { value: "drummond_loch", label: "Drummond Loch" },
          { value: "salmon", label: "Salmon & sea trout" },
          { value: "trout", label: "Trout" },
          { value: "grayling", label: "Grayling" },
          { value: "boat", label: "Boats" },
          { value: "permit_conditions", label: "Permit conditions" },
        ],
      },
      { name: "water_id", label: "Applies to water", type: "relation", source: "waters", nullable: true },
      { name: "beat_id", label: "Applies to beat", type: "relation", source: "beats", nullable: true },
      { name: "species_id", label: "Applies to species", type: "relation", source: "species", nullable: true },
      { name: "show_at_booking", label: "Show at booking", type: "boolean" },
      { name: "requires_acknowledgement", label: "Must be accepted before payment", type: "boolean" },
      { name: "is_published", label: "Published", type: "boolean" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  "membership-types": {
    key: "membership-types",
    table: "membership_types",
    singular: "Membership type",
    plural: "Membership types",
    titleField: "name",
    orderBy: "sort_order, name",
    hasNeedsConfirmation: true,
    list: [
      { label: "Name", field: "name" },
      { label: "Price", field: "price_pence", format: "money" },
      { label: "Joining fee", field: "joining_fee_pence", format: "money" },
      { label: "Active", field: "is_active", format: "bool" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Code", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "eligibility", label: "Eligibility", type: "textarea" },
      { name: "benefits", label: "Benefits", type: "lines", help: "One per line." },
      { name: "price_pence", label: "Annual price", type: "money", required: true },
      { name: "joining_fee_pence", label: "Joining fee (first year)", type: "money", required: true },
      { name: "expiry", label: "Memberships expire on", type: "monthday", monthCol: "expiry_month", dayCol: "expiry_day", required: true },
      { name: "online_application_enabled", label: "Accept online applications", type: "boolean" },
      { name: "is_active", label: "Active", type: "boolean" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  news: {
    key: "news",
    table: "news_posts",
    singular: "News post",
    plural: "News",
    titleField: "title",
    orderBy: "coalesce(published_at, created_at) desc",
    publicPath: (r) => (r.status === "published" ? `/news/${r.slug}` : null),
    list: [
      { label: "Title", field: "title" },
      { label: "Status", field: "status", format: "status" },
      { label: "Published", field: "published_at", format: "date" },
      { label: "Featured", field: "is_featured", format: "bool" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, section: "Article" },
      { name: "slug", label: "Web address", type: "slug", required: true, section: "Article", help: "Created from the title if left blank." },
      { name: "excerpt", label: "Summary", type: "textarea", max: 300, section: "Article" },
      { name: "body", label: "Article", type: "markdown", section: "Article" },
      { name: "cover_image_url", label: "Cover image", type: "image", folder: "news", altField: "cover_image_alt", section: "Article" },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published" }], section: "Publishing" },
      { name: "published_at", label: "Publish date", type: "datetime", nullable: true, section: "Publishing", help: "Set automatically when first published." },
      { name: "is_featured", label: "Feature at top of news page", type: "boolean", section: "Publishing" },
      ...seo,
    ],
  },
  pages: {
    key: "pages",
    table: "pages",
    singular: "Page",
    plural: "Pages",
    description: "About, privacy, terms and cancellation policy.",
    titleField: "title",
    orderBy: "title",
    hasNeedsConfirmation: true,
    canCreate: false,
    canDelete: false,
    publicPath: (r) => `/${r.slug}`,
    list: [{ label: "Title", field: "title" }, { label: "Address", field: "slug" }, { label: "Published", field: "is_published", format: "bool" }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "intro", label: "Introduction", type: "textarea" },
      { name: "body", label: "Content", type: "markdown" },
      { name: "is_published", label: "Published", type: "boolean" },
      ...seo,
    ],
  },
  "gallery-categories": {
    key: "gallery-categories",
    table: "gallery_categories",
    singular: "Gallery category",
    plural: "Gallery categories",
    nested: true,
    titleField: "name",
    orderBy: "sort_order, name",
    list: [{ label: "Name", field: "name" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Code", type: "slug", required: true },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
};

export function getResource(key: string): Resource | null {
  return Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : null;
}
