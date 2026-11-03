"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { EditionSchedule } from "@/lib/types";
import { formatEventTime } from "@/lib/datetime";
import { localizedField } from "@/lib/i18n-helpers";
import {
  DEFAULT_FIELDS,
  TEXT_FIELDS,
  buildRoomSections,
  buildTimeSections,
  formatFieldsParam,
  parseFields,
  parseGrouping,
  parseRoom,
  sectionToText,
  sessionValues,
  timeRange,
  type TextField,
  type TextGrouping,
  type TextItem,
  type TextLabels,
} from "@/lib/programme-text";

export interface ProgrammeTextLabels extends TextLabels {
  settings: string;
  settingsTitle: string;
  fieldLabels: Record<TextField, string>;
  grouping: string;
  byRoom: string;
  byTime: string;
  room: string;
  allRooms: string;
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

interface ViewState {
  fields: TextField[];
  room: number | null;
  grouping: TextGrouping;
}

// The plain view of the programme (#755). The page is rendered once and cached
// (#700), so the chosen fields, room and grouping are read here, in the
// browser — the cached HTML is the default view.
function ProgrammeTextWithUrl(props: ProgrammeTextProps) {
  const params = useSearchParams();
  return (
    <ProgrammeTextView
      {...props}
      initial={{
        fields: parseFields(params.get("fields")),
        room: parseRoom(params.get("room")),
        grouping: parseGrouping(params.get("group")),
      }}
    />
  );
}

export default function ProgrammeText(props: ProgrammeTextProps) {
  return (
    <Suspense
      fallback={<ProgrammeTextView {...props} initial={{ fields: [...DEFAULT_FIELDS], room: null, grouping: "room" }} />}
    >
      <ProgrammeTextWithUrl {...props} />
    </Suspense>
  );
}

/** Written back into the address bar, so the link a partner is sent keeps the view. */
function writeUrl({ fields, room, grouping }: ViewState) {
  const url = new URL(window.location.href);
  const param = formatFieldsParam(fields);
  if (param !== null) url.searchParams.set("fields", param);
  else url.searchParams.delete("fields");
  if (room !== null) url.searchParams.set("room", String(room));
  else url.searchParams.delete("room");
  if (grouping === "time") url.searchParams.set("group", "time");
  else url.searchParams.delete("group");
  window.history.replaceState(window.history.state, "", url);
}

export function ProgrammeTextView({ schedule, locale, labels, initial }: ProgrammeTextProps & { initial: ViewState }) {
  const [view, setView] = useState<ViewState>(initial);
  const { fields, room, grouping } = view;

  const { rooms, bands } = buildRoomSections(schedule);
  // A room id that matches nothing (renamed, deleted, mistyped) shows every
  // room rather than an empty page.
  const roomFilter = room !== null && rooms.some((s) => s.room.id === room) ? room : null;

  function update(next: Partial<ViewState>) {
    const merged = { ...view, ...next };
    setView(merged);
    writeUrl(merged);
  }

  function toggle(field: TextField) {
    update({ fields: fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field] });
  }

  const groupButton = (value: TextGrouping, label: string) => (
    <button
      type="button"
      aria-pressed={grouping === value}
      onClick={() => update({ grouping: value })}
      className={`px-3 py-1 ${grouping === value ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-4">
        <div role="group" aria-label={labels.grouping} className="flex overflow-hidden rounded-[8px] border border-gris/30 text-sm">
          {groupButton("room", labels.byRoom)}
          {groupButton("time", labels.byTime)}
        </div>

        <label className="flex items-center gap-2 text-sm">
          {labels.room}
          <select
            name="room"
            value={roomFilter ?? ""}
            onChange={(event) => update({ room: parseRoom(event.target.value) })}
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
                <input
                  type="checkbox"
                  name="fields"
                  value={field}
                  checked={fields.includes(field)}
                  onChange={() => toggle(field)}
                />
                {labels.fieldLabels[field]}
              </label>
            ))}
          </fieldset>
        </details>
      </div>

      {grouping === "room" ? (
        <>
          {rooms
            .filter((section) => roomFilter === null || section.room.id === roomFilter)
            .map((section) => (
              <Block
                key={section.room.id ?? `label:${section.room.name}`}
                heading={section.room.name || labels.roomTba}
                items={section.items}
                fields={fields}
                locale={locale}
                labels={labels}
                pageBreak
              />
            ))}

          {roomFilter === null && bands.length > 0 && (
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
        </>
      ) : (
        buildTimeSections(schedule).map((section) => {
          if (section.type === "band") {
            // With one room chosen, the shared moments still frame its day.
            return (
              <p key={section.key} className="programme-text-band mt-6 border-y border-gris/30 py-1 font-bold">
                {timeRange(section.entry.startsAt, section.entry.endsAt)} {localizedField(section.entry, "label", locale)}
              </p>
            );
          }
          const items = section.items.filter((item) => roomFilter === null || item.roomId === roomFilter);
          return items.length === 0 ? null : (
            <Block
              key={section.key}
              heading={formatEventTime(section.startsAt)}
              items={items}
              fields={fields}
              locale={locale}
              labels={labels}
            />
          );
        })
      )}
    </div>
  );
}

function Block({
  heading,
  items,
  fields,
  locale,
  labels,
  pageBreak = false,
}: {
  heading: string;
  items: TextItem[];
  fields: TextField[];
  locale: string;
  labels: ProgrammeTextLabels;
  /** A room is a sheet of its own on paper; a time slot is not. */
  pageBreak?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const withNotes = fields.includes("notes");

  async function copy() {
    try {
      await navigator.clipboard.writeText(sectionToText(items, fields, locale, labels));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <section className={`${pageBreak ? "programme-text-room" : "programme-text-slot"} mt-8 first:mt-0`}>
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-xl font-bold">{heading}</h2>
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
        {items.map((item) => {
          const values = sessionValues(item, fields, locale, labels);
          return (
            <li key={`${item.talk.slug}:${item.roomName ?? ""}`} className="programme-text-item border-b border-gris/20 py-2">
              {values.time !== undefined && <span className="mr-3 tabular-nums">{values.time}</span>}
              <span className="font-bold">{values.title}</span>
              {values.room !== undefined && <span className="ml-3 text-gris">{values.room}</span>}
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
