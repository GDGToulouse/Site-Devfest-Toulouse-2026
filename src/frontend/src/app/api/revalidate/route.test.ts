import { describe, it, expect, vi, beforeEach } from "vitest";

// The route reads REVALIDATE_SECRET at module load.
process.env.REVALIDATE_SECRET = "test-secret-not-a-real-credential";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const { POST } = await import("./route");

function post(body: unknown) {
  return new Request("http://localhost:3000/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // NextRequest accepts a plain Request at runtime; the route only reads
    // json() off it.
  }) as never;
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockReset();
  });

  it("purges everything through the root layout when asked for all (#358)", async () => {
    const res = await POST(post({ secret: "test-secret-not-a-real-credential", all: true }));

    expect(res.status).toBe(200);
    // "/" + layout is what Next documents as "invalidate all cached data".
    // Listing paths instead would miss the ~240 speaker pages an import writes.
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a global purge with a wrong secret", async () => {
    const res = await POST(post({ secret: "wrong", all: true }));

    // A global purge left unauthenticated is a denial of service by
    // invalidation: every page would rebuild on demand, on request.
    expect(res.status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still revalidates a list of paths, as the admin routes do", async () => {
    const res = await POST(
      post({ secret: "test-secret-not-a-real-credential", paths: ["/fr", "/en"] }),
    );

    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/fr");
    expect(revalidatePath).toHaveBeenCalledWith("/en");
    expect(revalidatePath).not.toHaveBeenCalledWith("/", "layout");
  });

  it("rejects a request that names neither paths nor all", async () => {
    const res = await POST(post({ secret: "test-secret-not-a-real-credential" }));

    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
