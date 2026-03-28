import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";

describe("Admin Settings API", () => {
  it("GET /api/admin/settings/cfp should return CFP config", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/settings/cfp" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("isOpen");
    expect(body).toHaveProperty("sessionizeUrl");
    await app.close();
  });

  it("PUT /api/admin/settings/cfp should update CFP config", async () => {
    const app = await buildAdminApp();

    // Get current
    const getRes = await app.inject({ method: "GET", url: "/api/admin/settings/cfp" });
    const current = getRes.json();

    // Update
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/settings/cfp",
      payload: {
        isOpen: !current.isOpen,
        sessionizeUrl: "https://sessionize.com/test",
        openDate: "2026-01-01",
        closeDate: "2026-03-01",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Restore
    await app.inject({
      method: "PUT",
      url: "/api/admin/settings/cfp",
      payload: current,
    });

    await app.close();
  });

  it("GET /api/admin/settings/key-figures should return figures", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/settings/key-figures" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("PUT /api/admin/settings/key-figures should update figures", async () => {
    const app = await buildAdminApp();

    // Get current
    const getRes = await app.inject({ method: "GET", url: "/api/admin/settings/key-figures" });
    const current = getRes.json();

    // Update with test data
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/settings/key-figures",
      payload: [
        { icon: "fa-users", value: "2000+", labelFr: "Participants", labelEn: "Attendees" },
        { icon: "fa-microphone", value: "80+", labelFr: "Speakers", labelEn: "Speakers" },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(2);

    // Restore
    await app.inject({
      method: "PUT",
      url: "/api/admin/settings/key-figures",
      payload: current,
    });

    await app.close();
  });
});
