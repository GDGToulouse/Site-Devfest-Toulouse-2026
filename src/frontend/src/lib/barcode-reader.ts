// Reading the Billetweb confirmation, QR code or barcode (RG-ARR-30, #642).
// Chrome on Android has BarcodeDetector built in; Safari on iOS does not, so
// it gets zxing-wasm, loaded only then. Its .wasm is served from our own
// origin (public/arrivees-zxing, copied from the package): the library's
// default CDN is blocked by our CSP, and must not be needed offline anyway.

// The QR code and the barcode carry the same value; which linear format
// Billetweb prints is not documented, so the usual ticketing ones are read.
const NATIVE_FORMATS = ["qr_code", "code_128", "code_39", "itf", "ean_13"];
const ZXING_FORMATS = ["QRCode", "Code128", "Code39", "ITF", "EAN13"] as const;

export const ZXING_WASM_URL = "/arrivees-zxing/zxing_reader.wasm";

// Not in TypeScript's DOM library yet.
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface NativeBarcodeDetectorClass {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

/** Reads one frame of the video; resolves to the code, or null when there is none. */
export type FrameReader = (video: HTMLVideoElement) => Promise<string | null>;

async function nativeReader(): Promise<FrameReader | null> {
  const Detector = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  const supported = await Detector.getSupportedFormats().catch(() => [] as string[]);
  const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
  if (!formats.includes("qr_code")) return null;
  const detector = new Detector({ formats });
  return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
}

async function loadZxing() {
  const zxing = await import("zxing-wasm/reader");
  await zxing.prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? ZXING_WASM_URL : prefix + path),
    },
    fireImmediately: true,
  });
  return zxing;
}

/** Frames are scaled down to this width: enough for a ticket held up close, light on a phone. */
const FRAME_WIDTH = 960;

async function zxingReader(): Promise<FrameReader> {
  const zxing = await loadZxing();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const results = await zxing.readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
      formats: [...ZXING_FORMATS],
      maxNumberOfSymbols: 1,
    });
    return results.find((r) => r.isValid)?.text ?? null;
  };
}

export async function createFrameReader(): Promise<FrameReader> {
  return (await nativeReader()) ?? zxingReader();
}

/**
 * Fetch zxing ahead of the first scan where it will be needed, while the
 * network is there: the service worker then keeps it for an offline morning.
 */
export async function preloadBarcodeReader(): Promise<void> {
  if (await nativeReader().catch(() => null)) return;
  await loadZxing().catch(() => undefined);
}
