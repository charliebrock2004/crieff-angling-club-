/**
 * OpenStreetMap embed: no API key, no cookies, loaded lazily.
 * Coordinates come from the admin panel; approximate positions are labelled.
 */
export function MapEmbed({ lat, lng, title, zoom = 14, approximate = false, className = "" }: { lat: number | null; lng: number | null; title: string; zoom?: number; approximate?: boolean; className?: string }) {
  if (lat === null || lng === null) {
    return (
      <div className={`flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-mist/50 p-6 text-center text-sm text-stone ${className}`}>
        Map location not yet set. Contact the club for directions.
      </div>
    );
  }
  const d = 0.018 * Math.pow(2, 14 - zoom);
  const bbox = [lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].map((v) => v.toFixed(5)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
  const full = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=${zoom + 1}/${lat.toFixed(5)}/${lng.toFixed(5)}`;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`;
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-mist shadow-[var(--shadow-card)]">
        <iframe title={`Map: ${title}`} src={src} loading="lazy" className="aspect-[4/3] w-full" referrerPolicy="no-referrer" />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-stone">
        <span>{approximate ? "Approximate location — check access notes before you travel." : title}</span>
        <span className="flex gap-4">
          <a href={full} target="_blank" rel="noopener noreferrer" className="link-underline">OpenStreetMap</a>
          <a href={gmaps} target="_blank" rel="noopener noreferrer" className="link-underline">Google Maps</a>
        </span>
      </figcaption>
    </figure>
  );
}
