import { expect, test as base, type Page } from "@playwright/test";

import { loadData, type E2EData } from "./data";

// The tests' own `test`: the fixture data, and a phone opened on a station by
// its QR link. Each station is a browser context of its own, as it is a phone
// of its own on the day (the session is a cookie, one station per cookie jar).

// The camera, faked: `getUserMedia` answers the stream of a canvas on which the
// ticket's QR code is drawn (testing.md § Local environment). The test sets
// `window.__e2eCamera.src` to the picture shown; unset, the camera sees white.
function fakeCamera() {
  const camera: { src: string | null } = { src: null };
  (window as unknown as { __e2eCamera: typeof camera }).__e2eCamera = camera;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const picture = new Image();
  let loaded: string | null = null;
  setInterval(() => {
    if (camera.src && camera.src !== loaded) {
      loaded = camera.src;
      picture.src = camera.src;
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (camera.src && picture.complete && picture.naturalWidth > 0) context.drawImage(picture, 120, 40, 400, 400);
  }, 100);
  navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(10);
}

// window.print() opens a dialog a headless run cannot answer: count the calls instead.
function countPrints() {
  const holder = window as unknown as { __e2ePrints: number };
  holder.__e2ePrints = 0;
  window.print = () => {
    holder.__e2ePrints += 1;
  };
}

export const test = base.extend<{
  data: E2EData;
  /** A new phone, opened on the station of that code (`scan`, `help`, `c1`…) through its QR link. */
  openStation: (code: string) => Promise<Page>;
}>({
  data: async ({}, use) => {
    await use(loadData());
  },

  openStation: async ({ browser }, use, testInfo) => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = testInfo.project.use;
    const data = loadData();
    const contexts: Array<{ close: () => Promise<void> }> = [];
    await use(async (code) => {
      const link = data.stations[code];
      if (!link) throw new Error(`The fixture has no station "${code}"`);
      const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL });
      contexts.push(context);
      await context.addInitScript(fakeCamera);
      await context.addInitScript(countPrints);
      const page = await context.newPage();
      // The link's origin is the backend's BASE_URL: the path is what counts.
      await page.goto(new URL(link).pathname);
      return page;
    });
    for (const context of contexts) await context.close();
  },
});

export { expect };

/** Shows the faked camera a ticket's QR code. */
export async function showToCamera(page: Page, qr: string): Promise<void> {
  await page.evaluate((src) => {
    (window as unknown as { __e2eCamera: { src: string | null } }).__e2eCamera.src = src;
  }, qr);
}
