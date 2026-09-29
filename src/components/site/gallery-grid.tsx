"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/content/queries";

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const close = useCallback(() => dialog.current?.close(), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    el.addEventListener("keydown", onKey);
    const onClose = () => setIndex(null);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("close", onClose);
    };
  }, [step]);

  const current = index !== null ? images[index] : null;
  return (
    <>
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
        {images.map((img, i) => (
          <li key={img.id} className="break-inside-avoid">
            <button type="button" onClick={() => open(i)} className="group relative block w-full overflow-hidden rounded-2xl bg-mist text-left">
              <Image src={img.url} alt={img.alt} width={img.width} height={img.height} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="h-auto w-full transition duration-700 group-hover:scale-[1.03]" />
              {img.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-peat/80 to-transparent p-4 pt-10 text-sm text-bone opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {img.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dialog} aria-label="Photo viewer" className="m-auto max-h-[100svh] max-w-[100vw] bg-transparent p-0 backdrop:bg-peat/95" onClick={(e) => e.target === dialog.current && close()}>
        {current && (
          <figure className="flex max-h-[100svh] flex-col items-center gap-3 p-4">
            <Image src={current.url} alt={current.alt} width={current.width} height={current.height} sizes="100vw" className="max-h-[80svh] w-auto rounded-lg object-contain" />
            <figcaption className="max-w-2xl text-center text-sm text-bone/85">
              {current.caption}
              {current.credit && <span className="block text-bone/50">Photo: {current.credit}</span>}
            </figcaption>
            <div className="flex gap-2">
              <button type="button" onClick={() => step(-1)} className="h-11 rounded-full bg-white/10 px-5 text-bone hover:bg-white/20">Previous</button>
              <button type="button" onClick={close} className="h-11 rounded-full bg-bone px-5 font-semibold text-peat">Close</button>
              <button type="button" onClick={() => step(1)} className="h-11 rounded-full bg-white/10 px-5 text-bone hover:bg-white/20">Next</button>
            </div>
          </figure>
        )}
      </dialog>
    </>
  );
}
