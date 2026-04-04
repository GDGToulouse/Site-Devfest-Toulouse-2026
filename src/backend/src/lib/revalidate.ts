const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "dev-secret";

export async function revalidatePaths(paths: string[] = ["/"]): Promise<void> {
  try {
    await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, paths }),
    });
  } catch {
    // Best-effort: don't fail the admin request if revalidation fails
  }
}

export function revalidateHome(): Promise<void> {
  return revalidatePaths(["/fr", "/en"]);
}
