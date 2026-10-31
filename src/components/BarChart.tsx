"use client";

import { ReactNode, useState } from "react";

export interface BarDatum {
  key: string;
  value: number | null; // null = no data synced for this slot
  label: string; // x-axis label (may be "" to skip)
  tooltip: ReactNode;
}

/**
 * Single-series bar chart drawn with plain elements: one hue, 4px rounded
 * data-ends, 2px gaps, recessive gridlines, hover tooltip, optional selection.
 */
export function BarChart({
  data,
  height = 200,
  format = (n) => n.toLocaleString("en-SG"),
  selectedKey,
  onSelect,
}: {
  data: BarDatum[];
  height?: number;
  format?: (n: number) => string;
  selectedKey?: string;
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value ?? 0)));
  const ticks = [max, max / 2, 0];

  return (
    <div className="flex gap-2 select-none">
      {/* y-axis */}
      <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular text-right w-10 shrink-0" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 leading-none">
            {format(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
          {/* gridlines */}
          {ticks.map((t, i) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${i === ticks.length - 1 ? "border-slate-300" : "border-dashed border-slate-200"}`}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          {/* bars */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const pct = max > 0 && d.value ? (d.value / max) * 100 : 0;
              const selected = selectedKey === d.key;
              const dim = (hover !== null && hover !== i) || (selectedKey && !selected && hover === null);
              return (
                <button
                  key={d.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onClick={() => onSelect?.(d.key)}
                  className={`relative flex-1 h-full flex items-end ${onSelect ? "cursor-pointer" : "cursor-default"}`}
                  aria-label={`${d.label || d.key}: ${d.value === null ? "no data" : format(d.value)}`}
                >
                  {d.value === null ? (
                    <span className="w-full h-1 rounded-full bg-slate-200" />
                  ) : (
                    <span
                      className={`w-full rounded-t-[4px] transition-opacity ${selected ? "bg-indigo-700" : "bg-indigo-500"} ${dim ? "opacity-40" : ""}`}
                      style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* tooltip */}
          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute z-10 -top-2 -translate-y-full -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-3 py-2 shadow-xl"
              style={{ left: `clamp(60px, ${((hover + 0.5) / data.length) * 100}%, calc(100% - 60px))` }}
            >
              {data[hover].tooltip}
            </div>
          )}
        </div>

        {/* x-axis labels */}
        <div className="flex gap-[2px] mt-1.5">
          {data.map((d) => (
            <span key={d.key} className="flex-1 text-center text-[10px] text-slate-400 tabular overflow-visible whitespace-nowrap">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceMax(n: number) {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n)!;
  return step * pow;
}
