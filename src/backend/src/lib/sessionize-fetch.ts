import { fetchRemoteFile } from "./safe-fetch.js";

// A Sessionize "All data" export weighs a few hundred kilobytes; the ceiling
// leaves room for a large event without letting a remote server fill memory.
const SESSIONIZE_MAX_BYTES = 10_000_000;

/** A Sessionize view, downloaded through the SSRF guard and parsed. */
export async function fetchSessionizeJson(url: string): Promise<unknown> {
  const { buffer } = await fetchRemoteFile(url, { maxBytes: SESSIONIZE_MAX_BYTES });
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    // Not the parser's message: it quotes the start of the body, which is
    // whatever the remote server sent (#658).
    throw new Error("La réponse de Sessionize n'est pas du JSON.");
  }
}
