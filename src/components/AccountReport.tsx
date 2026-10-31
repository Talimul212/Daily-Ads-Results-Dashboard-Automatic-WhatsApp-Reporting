"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
} from "lucide-react";
import { BarChart, BarDatum } from "./BarChart";
import { DateRange, DateRangePicker, presetRange } from "./DateRangePicker";

interface HourPoint {
  hour: number;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
}

interface DayMetric {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgCpc: number;
  cost: number;
  conversions: number;
  callConversions: number;
  whatsappConversions: number;
  perService: Record<string, number>;
  hourlyMetrics: HourPoint[];
}

interface ReportClient {
  id: string;
  name: string;
  specialistName: string | null;
  currency: string;
  highCpaThreshold: number | null;
  customerId: string | null;
  whatsappLinked: boolean;
  dailyMetrics: DayMetric[];
  reportLogs: { date: string; status: string; error: string | null; sentAt: string | null }[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
}

type TrendMetric = "conversions" | "clicks" | "cost";

const money = (n: number) =>
  n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-SG", { maximumFractionDigits: 2 });
const formatCid = (id: string) => id.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short" });

/**
 * One client's performance over a date range.
 * mode "internal": team view (sync, share link, WhatsApp status).
 * mode "client": the read-only page behind a client's share link.
 */
export function AccountReport({
  mode,
  dataUrl,
  campaignsUrl,
}: {
  mode: "internal" | "client";
  dataUrl: (start: string, end: string) => string;
  campaignsUrl: (client: ReportClient, start: string, end: string) => string | null;
}) {
  const internal = mode === "internal";
  const [range, setRange] = useState<DateRange>(() => presetRange(30));
  const [client, setClient] = useState<ReportClient | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("conversions");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignError, setCampaignError] = useState("");

  const load = async (r = range) => {
    setLoading(true);
    try {
      const res = await fetch(dataUrl(r.start, r.end));
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setClient(data.client);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedDate(null);
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const clientId = client?.id;
  useEffect(() => {
    if (!client) return;
    const url = campaignsUrl(client, range.start, range.end);
    if (!url) return;
    setCampaigns(null);
    setCampaignError("");
    fetch(url)
      .then((r) => r.json())
      .then((r) => (r.success ? setCampaigns(r.reports) : setCampaignError(r.error)))
      .catch(() => setCampaignError("Could not load campaigns."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, range.start, range.end]);

  // One slot per calendar day so gaps (never synced) stay visible.
  const series = useMemo(() => {
    if (!client) return [];
    const byDate = new Map(client.dailyMetrics.map((m) => [m.date, m]));
    const out: { date: string; metric: DayMetric | null }[] = [];
    const cursor = new Date(`${range.start}T00:00:00Z`);
    const end = new Date(`${range.end}T00:00:00Z`);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      out.push({ date, metric: byDate.get(date) ?? null });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }, [client, range.start, range.end]);

  const activeDate = selectedDate ?? range.end;
  const activeIndex = series.findIndex((s) => s.date === activeDate);
  const day = activeIndex >= 0 ? series[activeIndex].metric : null;
  const prevDay = activeIndex > 0 ? series[activeIndex - 1].metric : null;

  const periodTotals = useMemo(() => {
    const t = { clicks: 0, impressions: 0, cost: 0, conversions: 0, calls: 0, whatsapp: 0 };
    const services: Record<string, number> = {};
    for (const { metric: m } of series) {
      if (!m) continue;
      t.clicks += m.clicks;
      t.impressions += m.impressions;
      t.cost += m.cost;
      t.conversions += m.conversions;
      t.calls += m.callConversions;
      t.whatsapp += m.whatsappConversions;
      for (const [svc, n] of Object.entries(m.perService)) services[svc] = (services[svc] ?? 0) + n;
    }
    return { ...t, services: Object.entries(services).sort((a, b) => b[1] - a[1]) };
  }, [series]);

  const handleSync = async () => {
    if (!client) return;
    setSyncing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, startDate: range.start, date: range.end }),
      });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-500 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
      </div>
    );
  }
  if (!client) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Report not found."}{" "}
        {internal && <Link href="/" className="underline font-medium">Back to overview</Link>}
      </div>
    );
  }

  const cur = client.currency;
  const days = series.length;
  const trendData: BarDatum[] = series.map(({ date, metric }, i) => ({
    key: date,
    value: metric ? metric[trendMetric] : null,
    label: days <= 10 || i % Math.ceil(days / 8) === 0 ? shortDate(date) : "",
    tooltip: metric ? (
      <div className="space-y-0.5">
        <div className="font-semibold">{shortDate(date)}</div>
        <div>Conversions {num(metric.conversions)}</div>
        <div>Clicks {num(metric.clicks)}</div>
        <div>Cost {cur} {money(metric.cost)}</div>
      </div>
    ) : (
      <div>{shortDate(date)} · no data</div>
    ),
  }));

  const hourData: BarDatum[] = (day?.hourlyMetrics ?? []).map((h) => ({
    key: String(h.hour),
    value: h.clicks,
    label: h.hour % 3 === 0 ? `${String(h.hour).padStart(2, "0")}h` : "",
    tooltip: (
      <div className="space-y-0.5">
        <div className="font-semibold">{String(h.hour).padStart(2, "0")}:00 – {String(h.hour).padStart(2, "0")}:59</div>
        <div>Clicks {h.clicks}</div>
        <div>Conversions {num(h.conversions)}</div>
        <div>Cost {cur} {money(h.cost)}</div>
      </div>
    ),
  }));

  const cpa = day && day.conversions > 0 ? day.cost / day.conversions : null;
  const prevCpa = prevDay && prevDay.conversions > 0 ? prevDay.cost / prevDay.conversions : null;
  const report = client.reportLogs.find((r) => r.date === activeDate);
  const maxService = periodTotals.services[0]?.[1] ?? 0;

  return (
    <div className={`space-y-6 animate-fade-in transition-opacity ${loading ? "opacity-70" : ""}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          {internal ? (
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Daily Overview
            </Link>
          ) : (
            <div className="text-xs text-slate-500">Google Ads performance report</div>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{client.name}</h1>
          {internal && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono bg-white border border-slate-200 rounded-md px-2 py-0.5">
                CID {client.customerId ? formatCid(client.customerId) : "—"}
              </span>
              <span>Specialist: {client.specialistName || "Unassigned"}</span>
              <span>·</span>
              <span>{cur}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          {internal && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Re-pull this date range from Google Ads (3 API operations)"
                className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync"}
              </button>
              <ShareButton clientId={client.id} />
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Selected-day KPIs */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {new Date(`${activeDate}T00:00:00`).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <span className="text-xs text-slate-500">vs previous day · click a bar or row to change day</span>
        </div>
        {!day ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
            {internal ? "No data synced for this day. Use “Sync” to pull it." : "No data for this day yet."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Kpi label="Conversions" value={num(day.conversions)} now={day.conversions} before={prevDay?.conversions}>
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{num(day.callConversions)}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{num(day.whatsappConversions)}</span>
            </Kpi>
            <Kpi label="Clicks" value={num(day.clicks)} now={day.clicks} before={prevDay?.clicks}>
              {num(day.impressions)} impressions
            </Kpi>
            <Kpi label="CTR" value={`${day.ctr.toFixed(2)}%`} now={day.ctr} before={prevDay?.ctr}>
              Avg CPC {cur} {money(day.avgCpc)}
            </Kpi>
            <Kpi label="Cost" value={`${cur} ${money(day.cost)}`} now={day.cost} before={prevDay?.cost} neutral>
              Spend for the day
            </Kpi>
            <Kpi
              label="Cost / Conversion"
              value={cpa !== null ? `${cur} ${money(cpa)}` : "—"}
              now={cpa ?? undefined}
              before={prevCpa ?? undefined}
              lowerIsBetter
            >
              {internal && cpa !== null && client.highCpaThreshold && cpa > client.highCpaThreshold ? (
                <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Above {cur} {client.highCpaThreshold}
                </span>
              ) : (
                "Per lead"
              )}
            </Kpi>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Daily trend */}
        <Card className="xl:col-span-2" title="Daily trend" subtitle={`${shortDate(range.start)} – ${shortDate(range.end)} · ${days} days`}>
          <div className="flex items-center gap-1 mb-5">
            {(["conversions", "clicks", "cost"] as TrendMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setTrendMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                  trendMetric === m ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <BarChart data={trendData} format={num} selectedKey={activeDate} onSelect={setSelectedDate} />
        </Card>

        {/* Period summary */}
        <Card title="Period summary" subtitle={`${shortDate(range.start)} – ${shortDate(range.end)}`}>
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Conversions" value={num(periodTotals.conversions)} />
            <Stat label="Cost" value={`${cur} ${money(periodTotals.cost)}`} />
            <Stat label="Clicks" value={num(periodTotals.clicks)} />
            <Stat
              label="Cost / Conv."
              value={periodTotals.conversions ? `${cur} ${money(periodTotals.cost / periodTotals.conversions)}` : "—"}
            />
          </dl>
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 mb-2">Lead type</div>
            <SplitBar calls={periodTotals.calls} whatsapp={periodTotals.whatsapp} />
          </div>
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-2.5">
            <div className="text-xs font-medium text-slate-500">Conversions by service</div>
            {periodTotals.services.length === 0 && <p className="text-xs text-slate-400">No service conversions yet.</p>}
            {periodTotals.services.map(([svc, n]) => (
              <div key={svc} className="flex items-center gap-3 text-xs">
                <span className="w-20 truncate text-slate-700">{svc}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / maxService) * 100}%` }} />
                </div>
                <span className="w-10 text-right tabular font-medium text-slate-900">{num(n)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Hourly */}
        <Card className="xl:col-span-2" title="Clicks by hour" subtitle={shortDate(activeDate)}>
          {hourData.length ? (
            <BarChart data={hourData} height={160} />
          ) : (
            <p className="text-sm text-slate-400 py-10 text-center">No hourly data for this day.</p>
          )}
        </Card>

        {/* Report card */}
        <Card title={internal ? "WhatsApp report" : "Daily report card"} subtitle={internal ? "What the client group receives" : shortDate(activeDate)}>
          {internal && (
            <div className="flex items-center gap-2 text-xs mb-3">
              {report?.status === "SENT" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Sent
                </span>
              ) : report?.status === "FAILED" ? (
                <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium" title={report.error ?? ""}>
                  <AlertTriangle className="w-3 h-3" /> Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  <Clock className="w-3 h-3" /> Not sent
                </span>
              )}
              <span className="text-slate-500 truncate">
                {client.whatsappLinked ? "Group linked" : "No group linked yet"}
              </span>
            </div>
          )}
          {day ? (
            <img
              src={`/api/report-card/preview/${client.id}?date=${activeDate}`}
              alt={`Report card for ${activeDate}`}
              className="w-full rounded-xl border border-slate-200"
            />
          ) : (
            <p className="text-sm text-slate-400 py-10 text-center">No report for this day.</p>
          )}
        </Card>
      </div>

      {/* Live campaigns */}
      <Card title="Campaigns" subtitle={`${shortDate(range.start)} – ${shortDate(range.end)} · live from Google Ads`}>
        {campaignError ? (
          <p className="text-sm text-amber-700">{campaignError}</p>
        ) : !campaigns ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 py-6">No campaign activity in this period.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 px-5 font-medium">Campaign</th>
                  <th className="py-2 px-3 font-medium text-right">Clicks</th>
                  <th className="py-2 px-3 font-medium text-right">Conv.</th>
                  <th className="py-2 px-3 font-medium text-right">Cost</th>
                  <th className="py-2 px-5 font-medium text-right">CPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-5">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.status === "ENABLED" ? "bg-emerald-500" : c.status === "PAUSED" ? "bg-amber-400" : "bg-slate-300"}`} title={c.status} />
                        <span className="font-medium text-slate-900">{c.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">{num(c.clicks)}</td>
                    <td className="py-2.5 px-3 text-right tabular font-semibold">{num(c.conversions)}</td>
                    <td className="py-2.5 px-3 text-right tabular">{money(c.cost)}</td>
                    <td className="py-2.5 px-5 text-right tabular text-slate-600">{c.conversions ? money(c.cost / c.conversions) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Daily table */}
      <Card title="Daily history" subtitle="Newest first">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2 px-5 font-medium">Date</th>
                <th className="py-2 px-3 font-medium text-right">Conv.</th>
                <th className="py-2 px-3 font-medium text-right">Call / WA</th>
                <th className="py-2 px-3 font-medium text-right">Clicks</th>
                <th className="py-2 px-3 font-medium text-right">CTR</th>
                <th className="py-2 px-3 font-medium text-right">Cost</th>
                <th className="py-2 px-5 font-medium text-right">CPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...series].reverse().map(({ date, metric: m }) => (
                <tr
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`cursor-pointer transition-colors ${date === activeDate ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-5 text-slate-700">{shortDate(date)}</td>
                  {m ? (
                    <>
                      <td className="py-2.5 px-3 text-right tabular font-semibold">{num(m.conversions)}</td>
                      <td className="py-2.5 px-3 text-right tabular text-slate-500">{num(m.callConversions)} / {num(m.whatsappConversions)}</td>
                      <td className="py-2.5 px-3 text-right tabular">{num(m.clicks)}</td>
                      <td className="py-2.5 px-3 text-right tabular text-slate-500">{m.ctr.toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right tabular">{money(m.cost)}</td>
                      <td className="py-2.5 px-5 text-right tabular text-slate-500">{m.conversions ? money(m.cost / m.conversions) : "—"}</td>
                    </>
                  ) : (
                    <td colSpan={6} className="py-2.5 px-5 text-right text-xs text-slate-400">{internal ? "Not synced" : "No data"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Create / copy / replace / disable the client's read-only report link. */
function ShareButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (url === undefined) {
      fetch(`/api/client/${clientId}/share`).then((r) => r.json()).then((d) => setUrl(d.url ?? null));
    }
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, url, clientId]);

  const call = async (method: "POST" | "DELETE", rotate = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/client/${clientId}/share`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ rotate }) : undefined,
      });
      setUrl((await res.json()).url ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-2"
      >
        <Link2 className="w-3.5 h-3.5" /> Client link
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-4 space-y-3 animate-fade-in">
          <div>
            <div className="text-xs font-semibold text-slate-900">Share with the client</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Anyone with this link can view this account’s report (read-only, no login). Nothing else is visible.
            </p>
          </div>
          {url === undefined ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : url ? (
            <>
              <div className="flex items-center gap-2">
                <input readOnly value={url} className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-700" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="h-8 w-8 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex justify-between text-[11px]">
                <button disabled={busy} onClick={() => call("POST", true)} className="text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline">
                  Replace link (old one stops working)
                </button>
                <button disabled={busy} onClick={() => call("DELETE")} className="text-red-600 hover:underline underline-offset-2">
                  Turn off
                </button>
              </div>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() => call("POST")}
              className="w-full h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create client link"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-white border border-slate-200 shadow-sm p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  now,
  before,
  lowerIsBetter = false,
  neutral = false,
  children,
}: {
  label: string;
  value: string;
  now?: number;
  before?: number;
  lowerIsBetter?: boolean;
  neutral?: boolean;
  children?: React.ReactNode;
}) {
  const change = now !== undefined && before ? ((now - before) / before) * 100 : null;
  const good = change !== null && (lowerIsBetter ? change < 0 : change > 0);
  const tone = neutral || change === null || Math.abs(change) < 0.5
    ? "text-slate-500 bg-slate-100"
    : good
    ? "text-emerald-700 bg-emerald-50"
    : "text-rose-700 bg-rose-50";
  const Arrow = change !== null && change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {change !== null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular ${tone}`}>
            <Arrow className="w-3 h-3" />
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-900 tabular truncate">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-3">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular">{value}</dd>
    </div>
  );
}

function SplitBar({ calls, whatsapp }: { calls: number; whatsapp: number }) {
  const total = calls + whatsapp;
  if (!total) return <p className="text-xs text-slate-400">No call or WhatsApp conversions yet.</p>;
  const callPct = (calls / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        <div className="bg-indigo-500 rounded-l-full" style={{ width: `${callPct}%` }} />
        <div className="bg-teal-500 rounded-r-full flex-1" />
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> <Phone className="w-3 h-3" /> Calls {num(calls)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" /> <MessageCircle className="w-3 h-3" /> WhatsApp {num(whatsapp)}
        </span>
      </div>
    </div>
  );
}
