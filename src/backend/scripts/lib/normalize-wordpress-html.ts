import { parse, HTMLElement } from "node-html-parser";

/**
 * Converts legacy WordPress markup (Avada Fusion Builder, Gutenberg blocks and
 * classic-editor HTML) into clean, theme-independent HTML using Tailwind
 * utility classes. Runs at import time, before image re-hosting.
 *
 * The function is pure, synchronous and never throws: on any parsing error it
 * falls back to a regex-based cleanup so a malformed post still imports with
 * flattened-but-readable content instead of aborting the batch.
 *
 * Note: the backend sanitizer strips inline `style` and keeps only `class`, so
 * every layout decision here is expressed through classes, never inline style.
 * The emitted classes must be safelisted in the frontend (globals.css
 * `@source inline(...)`) because Tailwind v4 does not scan DB-stored HTML.
 */

// Allowlist of utility classes the normalizer itself emits. Every other class
// (theme chrome from Avada/Gutenberg, lazyload hints, social-embed bookkeeping,
// etc.) is stripped. An allowlist is used rather than a deny-list because the
// universe of legacy classes is open-ended, while the classes we emit are a
// small fixed set — and these are exactly the ones safelisted in globals.css.
const ALLOWED_CLASSES = new Set([
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
]);

const CAPTION_CLASS = "text-sm text-gris text-center";
const BUTTON_CLASS =
  "inline-block rounded-lg bg-bismarck text-blanc no-underline px-5 py-2 font-bold";
const CALLOUT_CLASS = "rounded-lg bg-blanc-casse p-4";
const IMG_CLASS = "w-full rounded-lg";
const CENTERED_IMG_CLASS = "mx-auto block rounded-lg";

export function normalizeWordpressHtml(html: string): string {
  if (!html || !html.trim()) return "";
  try {
    const root = parse(html, { comment: false });
    // Structural passes run first: they read fusion-*/wp-block-* classes to
    // rebuild grids. Class scrubbing happens last so those markers survive.
    stripStyles(root);
    rebuildFusion(root);
    cleanupGutenberg(root);
    cleanupGlobal(root);
    cleanupClassic(root);
    tidy(root);
    return root.toString();
  } catch {
    return fallbackClean(html);
  }
}

// --- Pass A1: strip inline styles (runs first; maps text-align to a class) --

function stripStyles(root: HTMLElement): void {
  for (const el of root.querySelectorAll("[style]")) {
    const style = el.getAttribute("style") ?? "";
    if (/text-align:\s*center/i.test(style)) addClass(el, "text-center");
    else if (/text-align:\s*right/i.test(style)) addClass(el, "text-right");
    else if (/text-align:\s*left/i.test(style)) addClass(el, "text-left");
    el.removeAttribute("style");
  }
  // FontAwesome icons carry no content on the new site.
  for (const icon of root.querySelectorAll("i")) icon.remove();
}

// --- Pass A2: attribute + class scrub (runs last, after grids are rebuilt) --

function cleanupGlobal(root: HTMLElement): void {
  for (const el of root.querySelectorAll("*")) {
    for (const attr of ["decoding", "loading", "srcset", "sizes"]) {
      el.removeAttribute(attr);
    }
    for (const name of Object.keys(el.attributes)) {
      if (name.startsWith("data-")) el.removeAttribute(name);
    }
    scrubClasses(el);
  }
  removeEmptyTextNodes(root);
}

// --- Pass B: Avada Fusion grid rebuild --------------------------------------

function rebuildFusion(root: HTMLElement): void {
  for (const row of root.querySelectorAll(".fusion-builder-row, .fusion-row")) {
    const columns = directColumns(row);
    if (columns.length === 0) continue;

    const cells = columns
      .map((col) => ({ fraction: columnFraction(col), node: unwrapColumn(col) }))
      .filter((c) => c.node && hasContent(c.node));
    if (cells.length === 0) {
      row.remove();
      continue;
    }

    // Avada lays every column in one flat flex row and relies on width % +
    // flex-wrap for visual rows. Segment consecutive same-fraction columns:
    // full-width (1/1) columns become flow content, runs of narrower columns
    // become a responsive grid.
    const container = parse("<div></div>").querySelector("div") as HTMLElement;
    for (const segment of segmentByFraction(cells)) {
      if (segment[0].fraction === 1) {
        for (const cell of segment) container.appendChild(flowOf(cell.node));
      } else {
        container.appendChild(buildGrid(segment));
      }
    }
    row.replaceWith(container);
  }

  // Atoms that may live outside a row too.
  for (const title of root.querySelectorAll(".fusion-title")) renameTag(title, "h2");
  for (const sep of root.querySelectorAll(".fusion-separator")) sep.replaceWith(parse("<hr>"));
  for (const btn of root.querySelectorAll("a.fusion-button")) styleButton(btn);
  for (const box of root.querySelectorAll(".fusion-content-boxes, .content-box")) {
    box.setAttribute("class", CALLOUT_CLASS);
  }
  for (const frame of root.querySelectorAll(".fusion-image-element, .fusion-imageframe")) {
    const img = frame.querySelector("img");
    if (img) frame.replaceWith(img);
    else frame.remove();
  }
}

function directColumns(row: HTMLElement): HTMLElement[] {
  return row
    .querySelectorAll(".fusion-layout-column")
    .filter((col) => col.closest(".fusion-builder-row, .fusion-row") === row);
}

// Reads the displayed fraction from the trailing `_X_Y` of the column class.
function columnFraction(col: HTMLElement): number {
  const match = col.classNames.match(/fusion_builder_column_(\d+)_(\d+)\b/);
  if (!match) return 1;
  const num = Number(match[1]);
  const den = Number(match[2]);
  return den > 0 ? num / den : 1;
}

// Lifts a column's real content out of the fusion-text/column-wrapper chrome
// and returns the resulting fragment element (a plain <div>).
function unwrapColumn(col: HTMLElement): HTMLElement {
  for (const wrapper of col.querySelectorAll(".fusion-text, .fusion-column-wrapper")) {
    wrapper.replaceWith(parse(wrapper.innerHTML));
  }
  const cell = parse("<div></div>").querySelector("div") as HTMLElement;
  cell.set_content(col.innerHTML);
  return cell;
}

type Cell = { fraction: number; node: HTMLElement };

// Splits a row's columns into consecutive runs of the same KIND: full-width
// (1/1) columns flow on their own; narrower columns group into one grid run.
function segmentByFraction(cells: Cell[]): Cell[][] {
  const segments: Cell[][] = [];
  for (const cell of cells) {
    const isFull = cell.fraction === 1;
    const last = segments[segments.length - 1];
    const lastIsFull = last && last[0].fraction === 1;
    if (last && isFull === lastIsFull) last.push(cell);
    else segments.push([cell]);
  }
  return segments;
}

function flowOf(node: HTMLElement): HTMLElement {
  const flow = parse("<div></div>").querySelector("div") as HTMLElement;
  flow.set_content(node.innerHTML);
  return flow;
}

// Builds a responsive grid from a run of sub-full-width columns. Quarters →
// 4-col, halves → 2-col, fifths → 5-col with col-spans; anything else stacks.
function buildGrid(cells: Cell[]): HTMLElement {
  const fractions = cells.map((c) => c.fraction);
  const allQuarters = fractions.every((f) => f === 0.25);
  const allHalves = fractions.every((f) => f === 0.5);
  const fifths = fractions.every((f) => Math.abs(f * 5 - Math.round(f * 5)) < 1e-9);

  let wrapperClass: string;
  let spanFor: (f: number) => string | null;

  if (allQuarters) {
    wrapperClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6";
    spanFor = () => null;
  } else if (allHalves) {
    wrapperClass = "grid grid-cols-1 md:grid-cols-2 gap-6";
    spanFor = () => null;
  } else if (fifths) {
    wrapperClass = "grid grid-cols-1 md:grid-cols-5 gap-8 items-center";
    spanFor = (f) => `md:col-span-${Math.round(f * 5)}`;
  } else {
    // Mixed/unknown denominators: stack full-width — readable, never broken.
    const stack = parse("<div></div>").querySelector("div") as HTMLElement;
    for (const cell of cells) stack.appendChild(cell.node);
    return stack;
  }

  const grid = parse(`<div class="${wrapperClass}"></div>`).querySelector("div") as HTMLElement;
  for (const { fraction, node } of cells) {
    styleCardImages(node);
    const span = spanFor(fraction);
    if (span) node.setAttribute("class", span);
    else node.removeAttribute("class");
    grid.appendChild(node);
  }
  return grid;
}

function styleCardImages(cell: HTMLElement): void {
  for (const img of cell.querySelectorAll("img")) img.setAttribute("class", IMG_CLASS);
}

function styleButton(btn: HTMLElement): void {
  // Drop the fusion-button-text <span> wrapper, keep the label.
  const label = btn.querySelector(".fusion-button-text");
  if (label) label.replaceWith(parse(label.innerHTML));
  btn.setAttribute("class", BUTTON_CLASS);
}

// --- Pass C: Gutenberg cleanup ----------------------------------------------

function cleanupGutenberg(root: HTMLElement): void {
  for (const fig of root.querySelectorAll("figure")) {
    const caption = fig.querySelector("figcaption");
    if (caption) renameTag(caption, "p", CAPTION_CLASS);
    renameTag(fig, "div");
  }

  for (const cols of root.querySelectorAll(".wp-block-columns")) {
    const inner = cols.querySelectorAll(".wp-block-column").filter(
      (c) => c.closest(".wp-block-columns") === cols,
    );
    const n = Math.min(Math.max(inner.length, 1), 4);
    const grid = parse(
      `<div class="grid grid-cols-1 md:grid-cols-${n} gap-6"></div>`,
    ).querySelector("div") as HTMLElement;
    for (const c of inner) {
      c.removeAttribute("class");
      grid.appendChild(c);
    }
    cols.replaceWith(grid);
  }

  for (const mt of root.querySelectorAll(".wp-block-media-text")) {
    mt.setAttribute("class", "grid grid-cols-1 md:grid-cols-2 gap-8 items-center");
  }

  for (const link of root.querySelectorAll("a.wp-block-button__link")) {
    link.setAttribute("class", BUTTON_CLASS);
  }
}

// --- Pass D: classic-editor cleanup -----------------------------------------

function cleanupClassic(root: HTMLElement): void {
  for (const img of root.querySelectorAll("img")) {
    if (img.getAttribute("class")) continue; // already styled (cards)
    img.setAttribute("class", CENTERED_IMG_CLASS);
  }

  // Strip leaked markdown hashes at the start of heading text.
  for (const h of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const text = h.innerHTML;
    const stripped = text.replace(/^\s*#{1,6}\s+/, "");
    if (stripped !== text) h.set_content(stripped);
  }
}

// --- Pass E: final tidy ------------------------------------------------------

function tidy(root: HTMLElement): void {
  // Remove wrappers left empty by unwrapping (run twice for nested cases).
  for (let i = 0; i < 2; i++) {
    for (const el of root.querySelectorAll("div, span")) {
      if (!el.getAttribute("class") && !hasContent(el)) el.remove();
    }
  }
  removeEmptyTextNodes(root);
}

// --- helpers -----------------------------------------------------------------

function scrubClasses(el: HTMLElement): void {
  const classNames = el.getAttribute("class");
  if (!classNames) return;
  const kept = classNames.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
  if (kept.length) el.setAttribute("class", kept.join(" "));
  else el.removeAttribute("class");
}

function addClass(el: HTMLElement, value: string): void {
  const existing = el.getAttribute("class");
  el.setAttribute("class", existing ? `${existing} ${value}` : value);
}

function renameTag(el: HTMLElement, tag: string, className?: string): void {
  el.rawTagName = tag;
  if (className) el.setAttribute("class", className);
  else el.removeAttribute("class");
}

function hasContent(el: HTMLElement): boolean {
  if (el.querySelector("img, iframe, hr, a")) return true;
  return el.text.replace(/ /g, "").trim().length > 0;
}

function removeEmptyTextNodes(root: HTMLElement): void {
  for (const p of root.querySelectorAll("p")) {
    if (!hasContent(p)) p.remove();
  }
  for (const h of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    if (!h.text.trim()) h.remove();
  }
}

// Regex fallback when DOM parsing throws — never worse than the input.
function fallbackClean(html: string): string {
  return html
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/--awb-[^;"]*;?/gi, "")
    .replace(/\sclass="[^"]*(fusion|awb|wp-block|lazyload)[^"]*"/gi, "");
}
