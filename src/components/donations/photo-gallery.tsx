import { ImageOff } from "lucide-react";

/** Photos are served through the authorized /api/files route. Only viewers with access receive URLs. */
export function PhotoGallery({ photos, title }: { photos: { id: string; url: string }[]; title: string }) {
  if (photos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
        <ImageOff className="size-5" aria-hidden /> No photos are visible to you for this donation.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p, i) => (
        <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-cream">
          <img src={p.url} alt={`${title}, photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
        </li>
      ))}
    </ul>
  );
}
