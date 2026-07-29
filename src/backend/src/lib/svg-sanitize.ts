import sanitizeHtml from "sanitize-html";

/**
 * Allowlist-based SVG sanitization, applied before an uploaded SVG is written
 * to disk (#346).
 *
 * SVG is an XML document, not an image format: it can carry `<script>`, event
 * handlers, external references and CSS. Files under /uploads/ are served
 * same-origin with their native content-type, and the CSP allows inline
 * scripts, so an unsanitized SVG opened directly would run JavaScript in our
 * origin — with a sponsor's magic link, that is a stored XSS from outside the
 * organisation (#306 excluded SVG entirely for this reason).
 *
 * The allowlist covers what a logo actually needs: shapes, paths, groups,
 * gradients, text and the transform/style attributes that position them.
 * Anything else is dropped rather than escaped, so the output stays a valid
 * SVG the browser can render.
 */
const ALLOWED_TAGS = [
  "svg", "g", "defs", "symbol", "use", "title", "desc",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan",
  "linearGradient", "radialGradient", "stop",
  "clipPath", "mask", "pattern",
  "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix",
  "feComposite", "feFlood", "feMerge", "feMergeNode",
];

// Presentation and geometry attributes. Deliberately excludes every `on*`
// handler and anything that can reference a remote document.
const ALLOWED_ATTRS = [
  "id", "class", "style", "transform",
  "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "viewBox", "preserveAspectRatio",
  "fill", "fill-opacity", "fill-rule", "clip-path", "clip-rule", "mask",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit",
  "opacity", "offset", "stop-color", "stop-opacity",
  "gradientUnits", "gradientTransform", "spreadMethod",
  "patternUnits", "patternContentUnits", "maskUnits", "maskContentUnits",
  "clipPathUnits", "filterUnits", "primitiveUnits",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor",
  "letter-spacing", "word-spacing", "dominant-baseline", "baseline-shift",
  "xmlns", "xmlns:xlink", "version",
  "in", "in2", "result", "stdDeviation", "dx", "dy", "mode", "values", "operator",
  "flood-color", "flood-opacity",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ALLOWED_ATTRS,
    // `href` only on `<use>`, and transformTags below has already reduced it to
    // a same-document fragment by the time the allowlist runs.
    use: [...ALLOWED_ATTRS, "href"],
  },
  // `<use href="…">` may only point inside the same document. An external
  // reference (http:, or another file) pulls in markup we never inspected, and
  // `javascript:` speaks for itself.
  allowedSchemes: [],
  allowedSchemesAppliedToAttributes: ["href", "xlink:href", "src"],
  // Drop the content too, not just the tag: keeping the text of a <script>
  // would leave the payload in the file even though it no longer executes.
  nonTextTags: ["script", "style", "foreignObject", "iframe", "object", "embed", "animate", "set"],
  parser: {
    // SVG tag and attribute names are case-sensitive: `viewBox` and `viewbox`
    // are not the same, and lowercasing would break rendering.
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
  },
};

/**
 * Returns the sanitized SVG source, or null when nothing usable survives —
 * a file whose only content was a script is not a logo, and the caller should
 * reject it rather than store an empty document.
 */
export function sanitizeSvg(source: string): string | null {
  // `<use>` self-references are kept, so allow same-document fragments through
  // before the scheme allowlist strips every other href.
  const cleaned = sanitizeHtml(source, {
    ...OPTIONS,
    transformTags: {
      use: (tagName, attribs) => {
        const ref = attribs["xlink:href"] ?? attribs.href;
        const isInternal = typeof ref === "string" && ref.startsWith("#");
        return {
          tagName,
          attribs: isInternal ? { ...attribs, href: ref } : stripHrefs(attribs),
        };
      },
    },
  });

  return /<svg[\s>]/i.test(cleaned) ? cleaned : null;
}

function stripHrefs(attribs: Record<string, string>): Record<string, string> {
  const { href: _href, "xlink:href": _xlink, ...rest } = attribs;
  return rest;
}
