import Image from "next/image";

interface SpeakerPhotoProps {
  photoUrl: string | null;
  name: string;
  // Rendered size in px; drives both the `sizes` hint and the initial's scale.
  size: number;
  className?: string;
}

// Imported speakers (#63) carry photos hosted wherever they were in 2016-2019 —
// twimg, googleusercontent, gravatar, a personal domain… Passing those to
// `next/image` throws "hostname is not configured" and takes the whole page down
// with a 500. Allow-listing ten hosts would break again on the eleventh, so
// third-party URLs skip the optimizer instead; own uploads keep it.
export default function SpeakerPhoto({ photoUrl, name, size, className }: SpeakerPhotoProps) {
  if (!photoUrl) {
    return (
      <span
        className="flex h-full w-full items-center justify-center font-bold text-gris"
        style={{ fontSize: Math.round(size / 2.6) }}
      >
        {name.charAt(0)}
      </span>
    );
  }

  const isExternal = photoUrl.startsWith("http");

  return (
    <Image
      src={photoUrl}
      alt={name}
      fill
      className={className ?? "object-cover"}
      sizes={`${size}px`}
      unoptimized={isExternal}
    />
  );
}
