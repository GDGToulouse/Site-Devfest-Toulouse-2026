import { fetchAndStoreImage } from "./image-store.js";

export function isLocalUpload(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/uploads/");
}

// Imported speaker pictures live on someone else's host — Sessionize's CDN
// (#205), or Twitter/Gravatar/company sites for the 2016-2025 history (#356).
// next/image refuses those hosts (absent from remotePatterns) and, worse, they
// rot: two of the historical URLs were already dead by 2026. So we pull the file
// into /uploads/ and store a local URL instead.
//
// Re-imports keep an existing local photo rather than downloading it again
// (RG-217 idempotence) — which also means a picture fixed by hand in the admin
// survives every re-run. A download failure is never fatal: the speaker is
// imported without a photo, falls back to their initials, and a warning names
// them in the report.
export async function resolveSpeakerPhoto(
  remoteUrl: string | null | undefined,
  currentPhotoUrl: string | null,
  speakerName: string,
  warnings: string[],
): Promise<string | null> {
  if (isLocalUpload(currentPhotoUrl)) return currentPhotoUrl;
  if (!remoteUrl?.trim()) return null;

  try {
    return await fetchAndStoreImage(remoteUrl.trim());
  } catch (err) {
    warnings.push(`Photo de ${speakerName} non importée : ${(err as Error).message}.`);
    return null;
  }
}
