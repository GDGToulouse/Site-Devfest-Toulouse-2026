"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  applyBadge,
  applyHelp,
  fromSnapshot,
  type ArrivalsSnapshot,
  type HelpEntry,
  type LiveBadge,
  type LiveState,
} from "@/lib/arrivals-live";

// The event-day screens' link to the backend (RG-ARR-60, RG-ARR-61, #641).
// EventSource reconnects on its own after most breaks, but not all: it gives
// up for good on an HTTP error (a relay's 502 during a redeploy), and it never
// notices a connection that went silent (a phone switching networks). Both
// are covered here, and every reconnection restarts from a fresh snapshot.

export type StreamStatus = "connected" | "reconnecting" | "disconnected";

/** Silence after which the link is presumed dead: two missed pings (15 s each, backend). */
export const STREAM_SILENCE_MS = 40_000;

/** A break that lasts longer turns the indicator red: the volunteer must know. */
export const STREAM_RED_AFTER_MS = 8_000;

/** Delay before a fresh attempt once EventSource has given up. */
const STREAM_RETRY_MS = 3_000;

type Handlers = Record<string, (data: unknown) => void>;

/**
 * One server-sent event stream kept alive, for the volunteers' screens and the
 * team's tracking screen (#644) alike. `firstEvent` is the one each
 * (re)connection opens with: the link counts as up once it has arrived.
 */
export function useEventStream(url: string | null, firstEvent: string, handlers: Handlers): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>("reconnecting");
  // The latest handlers, without reconnecting when a render makes new ones.
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (url === null) return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastHeardAt = Date.now();
    // When the link went down; null while it is up.
    let lostAt: number | null = Date.now();

    function markLost() {
      lostAt ??= Date.now();
      const isRed = !navigator.onLine || Date.now() - lostAt > STREAM_RED_AFTER_MS;
      setStatus(isRed ? "disconnected" : "reconnecting");
    }

    function heard() {
      lastHeardAt = Date.now();
    }

    function connect() {
      clearTimeout(retryTimer);
      source?.close();
      heard();
      const current = new EventSource(url!);
      source = current;
      for (const name of Object.keys(handlersRef.current)) {
        current.addEventListener(name, (e) => {
          heard();
          if (name === firstEvent) {
            lostAt = null;
            setStatus("connected");
          }
          handlersRef.current[name]?.(JSON.parse((e as MessageEvent<string>).data));
        });
      }
      current.addEventListener("ping", heard);
      current.onerror = () => {
        markLost();
        if (current.readyState === EventSource.CLOSED) retryTimer = setTimeout(connect, STREAM_RETRY_MS);
      };
    }

    const watchdog = setInterval(() => {
      if (lostAt !== null) markLost();
      else if (Date.now() - lastHeardAt > STREAM_SILENCE_MS) {
        markLost();
        connect();
      }
    }, 1_000);

    // The browser knows before the socket does: red at once, and back as soon
    // as the network is.
    function handleOffline() {
      markLost();
    }
    function handleOnline() {
      connect();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    connect();
    return () => {
      clearInterval(watchdog);
      clearTimeout(retryTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      source?.close();
    };
  }, [url, firstEvent]);

  return status;
}

export function useArrivalsStream(editionId: number | null): {
  live: LiveState | null;
  status: StreamStatus;
  /** A badge as a move's answer gives it: same version rule as the stream. */
  applyMoved: (badge: LiveBadge) => void;
} {
  const [live, setLive] = useState<LiveState | null>(null);

  const status = useEventStream(editionId === null ? null : `/api/arrivals/${editionId}/stream`, "snapshot", {
    snapshot: (data) => setLive(fromSnapshot(data as ArrivalsSnapshot)),
    badge: (data) => setLive((state) => (state ? applyBadge(state, data as LiveBadge) : state)),
    help: (data) => setLive((state) => (state ? applyHelp(state, data as HelpEntry) : state)),
  });

  const applyMoved = useCallback((badge: LiveBadge) => {
    setLive((state) => (state ? applyBadge(state, badge) : state));
  }, []);

  return { live, status, applyMoved };
}
