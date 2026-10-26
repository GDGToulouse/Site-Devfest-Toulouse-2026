import { Google_Sans } from "next/font/google";

// Shared by the two root layouts: the public site ([locale]/layout.tsx) and the
// application screens ((app)/layout.tsx). A font loader has to be called from a
// module scope, so both import this one instance (#700).
//
// `optional`, not `swap` (#481). next/font normally hides a font swap by
// emitting a fallback face with matching metrics, but it has none for Google
// Sans — the build says so out loud ("Failed to find font override values for
// font `Google Sans`. Skipping generating a fallback font."), and the built CSS
// carries no size-adjust/ascent-override rule to prove it. So `swap` replaced
// system-ui with a font of different metrics after first paint, and every line
// of the hero changed height: PageSpeed put the page's whole 0.063 CLS on
// `section.hero`, a 412 × 947 block — the entire first screen.
//
// With `optional` the browser takes the font if it is ready within its ~100 ms
// window and otherwise keeps the fallback for that page load, never swapping.
// The trade is that a first visit on a slow link may render in system-ui; the
// alternative, a hand-measured metric-matched fallback, keeps the brand font on
// those loads too and is the move if this trade reads wrong.
export const googleSans = Google_Sans({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-google-sans",
});
