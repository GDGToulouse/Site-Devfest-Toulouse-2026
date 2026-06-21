// Background "surface" for a home section. The page computes the alternating
// rhythm at render time over the sections that are actually visible (#135), so
// a section never needs to know its own position — it just receives a surface.
export type SectionSurface = "blanc" | "blanc-casse" | "accent";

// Maps a surface to its background utility class. "accent" is reserved for the
// key-figures highlight whose exact colour is decided in #136; until then it
// falls back to blanc-casse.
export function surfaceBgClass(surface: SectionSurface): string {
  switch (surface) {
    case "blanc-casse":
      return "bg-blanc-casse";
    case "accent":
      return "bg-blanc-casse";
    case "blanc":
    default:
      return "bg-blanc";
  }
}
