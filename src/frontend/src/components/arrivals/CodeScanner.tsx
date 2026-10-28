"use client";

import { useEffect, useRef, useState } from "react";

import { createFrameReader } from "@/lib/barcode-reader";

/** Pause between two frames read: a phone keeps its battery, the queue does not notice. */
const FRAME_INTERVAL_MS = 150;

// The camera, opened by the Scan button and closed as soon as a code is read
// (RG-ARR-30). The back camera, full width, so a ticket held at arm's length
// fills it; one hand holds the phone, the thumb reaches the close button.
export default function CodeScanner({ onRead, onClose }: { onRead: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  // The latest callback, without restarting the camera when the parent re-renders.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isStopped = false;

    function stop() {
      isStopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("La caméra n'a pas pu s'ouvrir. Autorisez-la dans les réglages du navigateur, ou saisissez le code.");
        return;
      }
      if (isStopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const read = await createFrameReader().catch(() => null);
      if (!read) {
        setError("Le lecteur de codes n'a pas pu démarrer. Saisissez le code à la main.");
        return;
      }
      const tick = async () => {
        if (isStopped) return;
        const code = video.readyState >= 2 ? await read(video).catch(() => null) : null;
        if (code && !isStopped) {
          stop();
          navigator.vibrate?.(80);
          onReadRef.current(code);
          return;
        }
        timer = setTimeout(tick, FRAME_INTERVAL_MS);
      };
      tick();
    })();

    return stop;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
          {error}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-noir">
          {/* playsInline: without it, iOS takes the video full screen. */}
          <video ref={videoRef} muted playsInline className="aspect-[3/4] w-full object-cover" aria-label="Caméra" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-blanc/80" />
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded-2xl border border-gris/30 bg-blanc px-4 py-4 font-medium text-noir"
      >
        Fermer la caméra
      </button>
    </div>
  );
}
