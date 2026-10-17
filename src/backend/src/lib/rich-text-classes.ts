// The only classes stored rich text may carry (#658): the utilities the
// WordPress import emits (scripts/lib/normalize-wordpress-html.ts), safelisted
// in the frontend's globals.css. The universe of legacy classes is open-ended,
// so the import keeps these and strips the rest; the sanitizer does the same
// for every write, since any other class would hand whoever writes rich text
// the site's whole utility CSS, down to a block laid over the page.
export const RICH_TEXT_CLASSES: readonly string[] = [
  "grid",
  "grid-cols-1",
  "sm:grid-cols-2",
  "md:grid-cols-2",
  "md:grid-cols-4",
  "md:grid-cols-5",
  "gap-6",
  "gap-8",
  "items-center",
  "md:col-span-2",
  "md:col-span-3",
  "w-full",
  "rounded-lg",
  "mx-auto",
  "block",
  "inline-block",
  "no-underline",
  "px-5",
  "py-2",
  "font-bold",
  "text-center",
  "text-left",
  "text-right",
  "text-sm",
  "text-gris",
  "p-4",
  "bg-bismarck",
  "text-blanc",
  "bg-blanc-casse",
];
