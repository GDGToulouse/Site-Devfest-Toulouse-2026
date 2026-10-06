/**
 * What to tell an editor when alt-text generation fails. Shared by the media
 * library button and the image picker: the picker used to say only "failed",
 * so a refused format or an exhausted quota read as an outage (#504).
 *
 * Reads `errorBody` from adminFetch: `data` is always null on an error, so the
 * retry delay of a 429 was never shown when read from there.
 */
export function altGenerationErrorMessage(status: number, errorBody?: Record<string, unknown>): string {
  if (status === 429) {
    const retryAfterSec = errorBody?.retryAfterSec;
    return typeof retryAfterSec === "number"
      ? `Quota Gemini atteint. Réessayez dans ${retryAfterSec} s.`
      : "Quota Gemini atteint. Réessayez plus tard.";
  }
  if (status === 503) return "Service IA non configuré (clé API manquante).";
  if (status === 415) return "Ce format d'image n'est pas pris en charge (ICO non supporté).";
  if (status === 400) return "L'image n'a pas pu être analysée.";
  if (status === 0) return "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.";
  return "Échec de la génération automatique du texte alternatif.";
}
