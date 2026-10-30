"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { EditionSchedule } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";
import {
  TEXT_FIELDS,
  buildRoomSections,
  formatFieldsParam,
  parseFields,
  parseRoom,
  sectionToText,
  sessionValues,
  timeRange,
  type RoomSection,
  type TextField,
  type TextLabels,
} from "@/lib/programme-text";

export interface ProgrammeTextLabels extends TextLabels {
  settings: string;
  settingsTitle: string;
  fieldLabels: Record<TextField, string>;
  room: string;
  allRooms: string;
  roomTba: string;
  copy: string;
  copyTitle: string;
  copied: string;
  copyFailed: string;
  common: string;
  notes: string;
}

interface ProgrammeTextProps {
  schedule: EditionSchedule;
  locale: string;
  labels: ProgrammeTextLabels;
}

// The plain view of the programme (#755). The page is rendered once and cached
// (#700), so the chosen fields and room are read here, in the browser — the
// cached HTML is the default view.
function ProgrammeTextWithUrl(props: ProgrammeTextProps) {
  const params = useSearchParams();
  return (
    <ProgrammeTextView
      {...props}
      initialFields={parseFields(params.get("fields"))}
      initialRoom={parseRoom(params.get("room"))}
    />
  );
}

export default function ProgrammeText(props: ProgrammeTextProps) {
  return (
    <Suspense fallback={<ProgrammeTextView {...props} initialFields={[]} initialRoom={null} />}>
      <ProgrammeTextWithUrl {...props} />
    </Suspense>
  );
}

/** Written back into the address bar, so the link a partner is sent keeps the view. */
function writeUrl(fields: readonly TextField[], room: number | null) {
  const url = new URL(window.location.href);
  const param = formatFieldsParam(fields);
  if (param) url.searchParams.set("fields", param);
  else url.searchParams.delete("fields");
  if (room !== null) url.searchParams.set("room", String(room));
  else url.searchParams.delete("room");
  window.history.replaceState(window.history.state, "", url);
}

export function ProgrammeTextView({
  schedule,
  locale,
  labels,
  initialFields,
  initialRoom,
}: ProgrammeTextProps & { initialFields: TextField[]; initialRoom: number | null }) {
  const [fields, setFields] = useState<TextField[]>(initialFields);
  const [room, setRoom] = useState<number | null>(initialRoom);

  const { rooms, bands } = buildRoomSections(schedule);
  // A room id that matches nothing (renamed, deleted, mistyped) shows every
  // room rather than an empty page.
  const shown = room !== null && rooms.some((s) => s.room.id === room) ? rooms.filter((s) => s.room.id === room) : rooms;

  function toggle(field: TextField) {
    const next = fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field];
    setFields(next);
    writeUrl(next, room);
  }

  function chooseRoom(value: string) {
    const next = parseRoom(value);
    setRoom(next);
    writeUrl(fields, next);
  }

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          {labels.room}
          <select
            name="room"
            value={room ?? ""}
            onChange={(event) => chooseRoom(event.target.value)}
            className="rounded-[8px] border border-gris/30 bg-blanc px-2 py-1"
          >
            <option value="">{labels.allRooms}</option>
            {rooms.map((section) =>
              section.room.id === null ? null : (
                <option key={section.room.id} value={section.room.id}>
                  {section.room.name || labels.roomTba}
                </option>
              ),
            )}
          </select>
        </label>

        <details className="relative">
          <summary
            title={labels.settingsTitle}
            className="flex cursor-pointer list-none items-center gap-1 rounded-[8px] border border-gris/30 bg-blanc px-2 py-1 text-sm [&::-webkit-details-marker]:hidden"
          >
            <span aria-hidden>⚙</span> {labels.settings}
          </summary>
          <fieldset className="absolute z-10 mt-1 flex min-w-48 flex-col gap-1 rounded-[8px] border border-gris/30 bg-blanc p-3 text-sm shadow-card">
            <legend className="sr-only">{labels.settingsTitle}</legend>
            {TEXT_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2">
                <input type="checkbox" name="fields" value={field} checked={fields.includes(field)} onChange={() => toggle(field)} />
                {labels.fieldLabels[field]}
              </label>
            ))}
          </fieldset>
        </details>
      </div>

      {shown.map((section) => (
        <RoomBlock
          key={section.room.id ?? `label:${section.room.name}`}
          section={section}
          fields={fields}
          locale={locale}
          labels={labels}
        />
      ))}

      {room === null && bands.length > 0 && (
        <section className="programme-text-room mt-8">
          <h2 className="text-xl font-bold">{labels.common}</h2>
          <ul className="mt-2">
            {bands.map((entry) => (
              <li key={entry.id} className="py-1">
                {timeRange(entry.startsAt, entry.endsAt)} {localizedField(entry, "label", locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RoomBlock({
  section,
  fields,
  locale,
  labels,
}: {
  section: RoomSection;
  fields: TextField[];
  locale: string;
  labels: ProgrammeTextLabels;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const withNotes = fields.includes("notes");

  async function copy() {
    try {
      await navigator.clipboard.writeText(sectionToText(section, fields, locale, labels));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <section className="programme-text-room mt-8 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-xl font-bold">{section.room.name || labels.roomTba}</h2>
        <button
          type="button"
          onClick={copy}
          title={labels.copyTitle}
          className="no-print rounded-[8px] border border-gris/30 bg-blanc px-2 py-0.5 text-sm"
        >
          {labels.copy}
        </button>
        <span role="status" className="no-print text-sm text-gris">
          {status === "copied" ? labels.copied : status === "failed" ? labels.copyFailed : ""}
        </span>
      </div>
      <ul className="mt-2">
        {section.items.map((cell) => {
          const values = sessionValues(cell, fields, locale, labels);
          return (
            <li key={cell.talk.slug} className="programme-text-item border-b border-gris/20 py-2">
              {values.time !== undefined && <span className="mr-3 tabular-nums">{values.time}</span>}
              <span className="font-bold">{values.title}</span>
              {values.speakers && <span className="block">{values.speakers}</span>}
              {(values.extra.some(Boolean) || values.simulcast) && (
                <span className="block text-gris">
                  {[...values.extra, values.simulcast].filter(Boolean).join(" · ")}
                </span>
              )}
              {withNotes && (
                <span className="programme-text-notes mt-2 block h-16 border border-dashed border-gris/40">
                  <span className="sr-only">{labels.notes}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
