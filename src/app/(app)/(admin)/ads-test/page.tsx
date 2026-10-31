"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  DollarSign,
  Loader2,
  MousePointerClick,
  Eye,
  Search,
  Target,
  Percent,
  Receipt,
} from "lucide-react";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

interface Totals {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

const RANGES = [
  { value: "LAST_7_DAYS", label: "7D" },
  { value: "LAST_14_DAYS", label: "14D" },
  { value: "LAST_30_DAYS", label: "30D" },
  { value: "", label: "90D" },
];

type SortKey = "name" | "cost" | "clicks" | "impressions" | "conversions" | "cpa";

const money = (n: number) =>
  n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => n.toLocaleString("en-SG");

export default function CampaignReportsPage() {
  const [customerId, setCustomerId] = useState("");
  const [range, setRange] = useState("LAST_30_DAYS");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CampaignRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("cost");

  const fetchReport = async (nextRange = range) => {
    if (!customerId) return;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ customerId });
      if (nextRange) params.set("range", nextRange);
      const res = await fetch(`/api/ads-report?${params}`);
      const result = await res.json();

      if (result.success) {
        setData(result.reports);
        setTotals(result.totals);
      } else {
        setData(null);
        setTotals(null);
        setError(result.error);
      }
    } catch {
      setError("Could not reach the server. Is `npm run dev` running?");
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    const cpa = (c: CampaignRow) => (c.conversions > 0 ? c.cost / c.conversions : Infinity);
    return [...data].sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name)
        : sortBy === "cpa" ? cpa(a) - cpa(b)
        : b[sortBy] - a[sortBy]
    );
  }, [data, sortBy]);

  const kpis = totals && [
    { label: "Spend", value: `SGD ${money(totals.cost)}`, icon: DollarSign, tone: "emerald" },
    { label: "Clicks", value: int(totals.clicks), icon: MousePointerClick, tone: "blue" },
    { label: "Impressions", value: int(totals.impressions), icon: Eye, tone: "violet" },
    { label: "Conversions", value: money(totals.conversions), icon: Target, tone: "rose" },
    {
      label: "CTR",
      value: totals.impressions ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : "—",
      icon: Percent,
      tone: "amber",
    },
    {
      label: "Cost / Conv.",
      value: totals.conversions ? `SGD ${money(totals.cost / totals.conversions)}` : "—",
      icon: Receipt,
      tone: "slate",
    },
  ];

  const isAccessError = /Test access|test accounts/i.test(error);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Campaign Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pull live campaign performance for any client sub-account under your MCC.
          </p>
        </div>
      </div>

      {/* Query bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchReport();
        }}
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col md:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Sub-account Customer ID, e.g. 123-456-7890"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-mono"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 h-11">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                setRange(r.value);
                if (data) fetchReport(r.value);
              }}
              className={`px-3.5 h-full rounded-lg text-xs font-semibold transition ${
                range === r.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !customerId}
          className="h-11 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Fetching…" : "Get Report"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 flex gap-4">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-900">Google Ads didn’t return data</p>
            <p className="text-amber-800">{error}</p>
            {isAccessError && (
              <ol className="list-decimal pl-5 text-amber-800 space-y-1">
                <li>Open Google Cloud Console with the project that owns your OAuth Client ID.</li>
                <li>Go to APIs &amp; Services → Google Ads API → Overview.</li>
                <li>Expand “Upgrade access level” and click “Apply for access” (Explorer).</li>
                <li>Once approved, reload this page. No new refresh token is needed.</li>
              </ol>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      {loading && !kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}
      {kpis && (
        <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 transition ${loading ? "opacity-60" : ""}`}>
          {kpis.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-3 text-xl font-semibold text-slate-900 tabular truncate">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign table */}
      {data && (
        <div className={`rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden transition ${loading ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Campaigns</h2>
              <p className="text-xs text-slate-500">{data.length} with activity in this period</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 outline-none"
              >
                <option value="cost">Spend</option>
                <option value="conversions">Conversions</option>
                <option value="clicks">Clicks</option>
                <option value="impressions">Impressions</option>
                <option value="cpa">Lowest CPA</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {data.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No campaign activity for this account in the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                    <th className="py-3 px-5 font-medium">Campaign</th>
                    <th className="py-3 px-3 font-medium text-right">Impr.</th>
                    <th className="py-3 px-3 font-medium text-right">Clicks</th>
                    <th className="py-3 px-3 font-medium text-right">CTR</th>
                    <th className="py-3 px-3 font-medium text-right">Conv.</th>
                    <th className="py-3 px-3 font-medium text-right">CPA</th>
                    <th className="py-3 px-5 font-medium w-[220px]">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((c) => {
                    const share = totals?.cost ? (c.cost / totals.cost) * 100 : 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <StatusDot status={c.status} />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate max-w-[320px]">{c.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">#{c.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right tabular text-slate-600">{int(c.impressions)}</td>
                        <td className="py-3.5 px-3 text-right tabular text-slate-900 font-medium">{int(c.clicks)}</td>
                        <td className="py-3.5 px-3 text-right tabular text-slate-600">
                          {c.impressions ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular font-semibold text-slate-900">
                          {money(c.conversions)}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular text-slate-600">
                          {c.conversions ? money(c.cost / c.conversions) : "—"}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${share}%` }} />
                            </div>
                            <span className="tabular text-slate-900 font-medium w-20 text-right">
                              {money(c.cost)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* First-visit empty state */}
      {!data && !error && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-900">Enter a Customer ID to load its campaigns</p>
          <p className="mt-1 text-xs text-slate-500">
            Use the client’s sub-account ID, not the MCC ID. Dashes are fine.
          </p>
        </div>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ENABLED" ? "bg-emerald-500" : status === "PAUSED" ? "bg-amber-400" : "bg-slate-300";
  return <span title={status} className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}
