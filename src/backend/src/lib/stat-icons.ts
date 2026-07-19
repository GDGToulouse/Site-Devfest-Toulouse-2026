// Valid key-figure icon keys (#164).
//
// The rendering catalogue (icon definitions, labels) lives in the frontend at
// src/frontend/src/lib/stat-icons.ts — Font Awesome has no business in the API.
// Only the keys are mirrored here, to reject values the site could not render:
// the admin picker guards the UI, this guards direct API calls and imports.
//
// Keep both lists in sync when adding an icon. A test asserts they match.
export const STAT_ICON_KEYS = [
  "calendar",
  "users",
  "microphone",
  "handshake",
  "location",
  "clock",
  "ticket",
  "coffee",
  "code",
  "lightbulb",
  "trophy",
  "heart",
  "rocket",
  "star",
  "building",
  "gift",
] as const;

// An empty icon is allowed: a key figure may be displayed without one.
export function isValidStatIcon(icon: string): boolean {
  return icon === "" || (STAT_ICON_KEYS as readonly string[]).includes(icon);
}
