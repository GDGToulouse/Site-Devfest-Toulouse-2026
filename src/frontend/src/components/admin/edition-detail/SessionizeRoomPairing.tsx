"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  adminGetSessionizeRooms,
  adminPairSessionizeRoom,
  type SessionizeRooms,
} from "@/lib/admin-api";

interface SessionizeRoomPairingProps {
  editionId: number;
  /** Changes after each import, which may have brought new rooms. */
  refreshKey: number;
}

// Sessionize and the venue name their rooms differently ("Amphi" and
// "Amphithéâtre"): the admin pairs them once per edition, and every import
// after that places the sessions in the paired room (#519).
export default function SessionizeRoomPairing({ editionId, refreshKey }: SessionizeRoomPairingProps) {
  const [loaded, setLoaded] = useState<{ key: string; rooms: SessionizeRooms | null } | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${editionId}:${refreshKey}`;

  useEffect(() => {
    let isCurrent = true;
    adminGetSessionizeRooms(editionId).then(({ data }) => {
      if (isCurrent) setLoaded({ key, rooms: data });
    });
    return () => {
      isCurrent = false;
    };
  }, [editionId, key]);

  const rooms = loaded?.key === key ? loaded.rooms : null;
  if (!rooms || rooms.pairings.length === 0) return null;

  async function handlePair(sessionizeId: number, name: string, value: string) {
    setError(null);
    setSavedName(null);
    const roomId = value === "" ? null : Number(value);
    const { data, status } = await adminPairSessionizeRoom(editionId, sessionizeId, roomId);
    if (status !== 200 || !data) {
      setError(`L'association de « ${name} » n'a pas été enregistrée. Réessayez.`);
      return;
    }
    setLoaded((current) =>
      current && current.rooms
        ? {
            ...current,
            rooms: {
              ...current.rooms,
              pairings: current.rooms.pairings.map((pairing) =>
                pairing.sessionizeId === sessionizeId ? data : pairing,
              ),
            },
          }
        : current,
    );
    setSavedName(name);
  }

  return (
    <section className="space-y-3" aria-labelledby="sessionize-rooms-title">
      <div>
        <h3 id="sessionize-rooms-title" className="font-bold text-noir">
          Salles Sessionize
        </h3>
        {rooms.venue ? (
          <p className="text-sm text-gris mt-1">
            Associez chaque salle Sessionize à une salle de {rooms.venue.name}. L&apos;association
            sert à tous les imports de cette édition&nbsp;: <strong>relancez l&apos;import</strong>{" "}
            pour placer les sessions déjà importées.
          </p>
        ) : (
          <p className="text-sm text-terre-cuite mt-1">
            Cette édition n&apos;a pas de lieu&nbsp;: choisissez-le dans la fiche de l&apos;édition
            pour pouvoir associer les salles.
          </p>
        )}
      </div>

      {rooms.venue && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gris">
              <th className="py-1 pr-4 font-medium">Salle Sessionize</th>
              <th className="py-1 font-medium">Salle du lieu</th>
            </tr>
          </thead>
          <tbody>
            {rooms.pairings.map((pairing) => (
              <tr key={pairing.sessionizeId} className="border-t border-gris/10">
                <td className="py-2 pr-4 text-noir">{pairing.name}</td>
                <td className="py-2">
                  <select
                    aria-label={`Salle du lieu pour « ${pairing.name} »`}
                    value={pairing.roomId ?? ""}
                    onChange={(e) => handlePair(pairing.sessionizeId, pairing.name, e.target.value)}
                    className={`w-full max-w-[260px] rounded-lg border px-3 py-1.5 bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 ${
                      pairing.roomId === null ? "border-terre-cuite/50 text-gris" : "border-gris/30 text-noir"
                    }`}
                  >
                    <option value="">Non associée</option>
                    {rooms.venueRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rooms.venue && (
        <p className="text-xs text-gris">
          Une salle manque&nbsp;? Ajoutez-la au lieu dans{" "}
          <Link href="/admin/venues" className="text-malachite underline">
            Lieux
          </Link>
          .
        </p>
      )}
      {savedName && (
        <p role="status" className="text-sm text-malachite">
          {`Association de « ${savedName} » enregistrée. Relancez l'import pour l'appliquer.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-terre-cuite">
          {error}
        </p>
      )}
    </section>
  );
}
