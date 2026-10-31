"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

export interface DateRange {
  preset: number | null; // 7 / 30 / 90, or null for a custom range
  start: string; // YYYY-MM-DD
  end: string;
}

export const PRESETS = [7, 30, 90];

/** Yesterday in Singapore time: the latest day the nightly sync has data for. */
export function latestDataDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(
    new Date(Date.now() - 86_400_000)
  );
}

export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function presetRange(days: number): DateRange {
  const end = latestDataDate();
  return { preset: days, start: shiftDate(end, -(days - 1)), end };
}

const fmt = (d: string, withYear = false) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ start: value.start, end: value.end });
  const ref = useRef<HTMLDivElement>(null);
  const max = latestDataDate();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const valid = draft.start && draft.end && draft.start <= draft.end && draft.end <= max;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(presetRange(d))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              value.preset === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {d}D
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setDraft({ start: value.start, end: value.end });
            setOpen((o) => !o);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 ${
            value.preset === null ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {value.preset === null ? `${fmt(value.start)} – ${fmt(value.end, true)}` : "Custom"}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-4 space-y-3 animate-fade-in">
          <div className="text-xs font-semibold text-slate-900">Custom date range</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">From</span>
              <input
                type="date"
                value={draft.start}
                max={draft.end || max}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-indigo-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">To</span>
              <input
                type="date"
                value={draft.end}
                min={draft.start}
                max={max}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-indigo-400"
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">Data is available up to yesterday ({fmt(max)}).</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                onChange({ preset: null, ...draft });
                setOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
