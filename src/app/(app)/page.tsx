"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Search,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  Copy,
  Check,
  X,
  User,
  Maximize2,
  Minimize2,
  ArrowLeft,
} from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  specialistName: string;
  specialistId: string | null;
  currency: string;
  highCpaThreshold: number;
  requiresApproval: boolean;
  googleAdsAccount: {
    customerId: string;
    loginCustomerId: string | null;
    status: string;
  } | null;
  whatsappGroup: {
    groupId: string | null;
    fallbackPhone: string | null;
    status: string;
  } | null;
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgCpc: number;
    cost: number;
    conversions: number;
    callConversions: number;
    whatsappConversions: number;
    cpa: number;
    perService: Record<string, number>;
  } | null;
  reportLog: {
    status: string;
    sentAt: string | null;
    error: string | null;
    retries: number;
  } | null;
  flags: string[];
  needsAttention: boolean;
}

interface DashboardSummary {
  totalCompanies: number;
  totalConversions: number;
  totalCost: number;
  totalClicks: number;
  averageCpa: number;
  needsAttentionCount: number;
}

export default function DashboardPage() {
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [specialists, setSpecialists] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>("ALL");
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ATTENTION" | "PENDING" | "SENT">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "conversions" | "cost" | "cpa">("conversions");

  // Selected Client Centered Modal Popup
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          setSelectedClient(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  // Fetch Dashboard data
  const fetchDashboard = async (targetDate?: string, specialistId?: string) => {
    setLoading(true);
    try {
      const qDate = targetDate || date;
      let url = `/api/dashboard?`;
      if (qDate) url += `date=${qDate}&`;
      if (specialistId && specialistId !== "ALL") url += `specialistId=${specialistId}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDate(data.date);
        setSummary(data.summary);
        setClients(data.clients);
        setSpecialists(data.specialists);
        setIsAdminView(data.viewer?.role === "ADMIN");
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    fetchDashboard(newDate, selectedSpecialist);
  };

  const handleSpecialistChange = (specId: string) => {
    setSelectedSpecialist(specId);
    fetchDashboard(date, specId);
  };

  const handleRunSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Sync finished! ${data.summary.succeeded} clients updated successfully.`);
        await fetchDashboard(date, selectedSpecialist);
      } else {
        showToast(`Sync error: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendWhatsApp = async (client: ClientRow, force: boolean = false) => {
    setSendingId(client.id);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, date, forceResend: force }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`WhatsApp report dispatched to ${client.name}!`);
        await fetchDashboard(date, selectedSpecialist);
        if (selectedClient && selectedClient.id === client.id) {
          setSelectedClient({
            ...selectedClient,
            reportLog: {
              status: "SENT",
              sentAt: new Date().toISOString(),
              error: null,
              retries: (selectedClient.reportLog?.retries || 0) + 1,
            },
          });
        }
      } else {
        showToast(`Failed to send WhatsApp: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Send error: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter clients
  const filteredClients = clients
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.googleAdsAccount?.customerId.includes(searchQuery) ||
        c.specialistName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeTab === "ATTENTION") return c.needsAttention;
      if (activeTab === "PENDING") return c.reportLog?.status !== "SENT";
      if (activeTab === "SENT") return c.reportLog?.status === "SENT";

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "conversions") return (b.metrics?.conversions ?? 0) - (a.metrics?.conversions ?? 0);
      if (sortBy === "cost") return (b.metrics?.cost ?? 0) - (a.metrics?.cost ?? 0);
      if (sortBy === "cpa") return (b.metrics?.cpa ?? 0) - (a.metrics?.cpa ?? 0);
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
            />
          </div>

          {/* Specialist Filter (admins only; specialists only ever get their own clients) */}
          <div className={`items-center gap-2 ${isAdminView ? "flex" : "hidden"}`}>
            <User className="w-4 h-4 text-gray-400" />
            <select
              value={selectedSpecialist}
              onChange={(e) => handleSpecialistChange(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-xs font-medium rounded-lg px-2.5 py-2 text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value="ALL">All Specialists (Admin View)</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={handleRunSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing Ads Data..." : "Run Google Ads Sync"}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Accounts */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <span>Client Accounts</span>
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">
            {summary?.totalCompanies ?? "--"}
          </div>
          <div className="text-xs text-gray-500 mt-1">All active Singapore clients</div>
        </div>

        {/* KPI 2: Total Conversions */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Conversions</span>
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
          </div>
          <div className="text-3xl font-extrabold text-red-600 dark:text-red-400 mt-2">
            {summary?.totalConversions ?? "--"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Calls & WhatsApp leads generated</div>
        </div>

        {/* KPI 3: Total Ad Spend */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Ad Spend</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            SGD {summary?.totalCost?.toFixed(2) ?? "--"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg CPA: SGD {summary?.averageCpa?.toFixed(2) ?? "--"} / conv
          </div>
        </div>

        {/* KPI 4: Needs Attention */}
        <div
          onClick={() => setActiveTab("ATTENTION")}
          className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm relative overflow-hidden cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Needs Attention</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            {summary?.needsAttentionCount ?? 0}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
            High CPA, 0 conversions, or missing data
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === "ALL"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            All Companies ({clients.length})
          </button>
          <button
            onClick={() => setActiveTab("ATTENTION")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === "ATTENTION"
                ? "bg-amber-600 text-white"
                : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            Needs Attention ({clients.filter((c) => c.needsAttention).length})
          </button>
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === "PENDING"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Pending Send ({clients.filter((c) => c.reportLog?.status !== "SENT").length})
          </button>
          <button
            onClick={() => setActiveTab("SENT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === "SENT"
                ? "bg-emerald-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Sent ({clients.filter((c) => c.reportLog?.status === "SENT").length})
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search client or CID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="conversions">Sort: Conversions</option>
            <option value="cost">Sort: Cost</option>
            <option value="cpa">Sort: CPA</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Main Companies Table (Fully Responsive with horizontal scroll) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-4">Company & Account</th>
                <th className="py-3 px-3">Specialist</th>
                <th className="py-3 px-3 text-right">Conversions</th>
                <th className="py-3 px-3">Split (Call / WA)</th>
                <th className="py-3 px-3 text-right">Clicks / CTR</th>
                <th className="py-3 px-3 text-right">Cost (SGD)</th>
                <th className="py-3 px-3 text-right">CPA</th>
                <th className="py-3 px-3">Services</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading daily performance data...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-500">
                    No clients found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const m = client.metrics;
                  const isSent = client.reportLog?.status === "SENT";

                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                    >
                      {/* Company Name & CID */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/clients/${client.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-gray-900 dark:text-white text-sm hover:text-indigo-600 hover:underline underline-offset-2"
                        >
                          {client.name}
                        </Link>
                        <div className="text-gray-400 text-xs font-mono mt-0.5">
                          CID: {client.googleAdsAccount?.customerId || "No Account"}
                        </div>
                      </td>

                      {/* Specialist */}
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-[11px]">
                          {client.specialistName}
                        </span>
                      </td>

                      {/* Total Conversions */}
                      <td className="py-3.5 px-3 text-right font-extrabold text-sm text-red-600 dark:text-red-400">
                        {m?.conversions ?? "--"}
                      </td>

                      {/* Split Call / WA */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-semibold border border-blue-200 dark:border-blue-800">
                            <Phone className="w-2.5 h-2.5" />
                            {m?.callConversions ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                            <MessageCircle className="w-2.5 h-2.5" />
                            {m?.whatsappConversions ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Clicks / CTR */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {m?.clicks ?? "--"}
                        </div>
                        <div className="text-gray-400 text-[11px]">{m ? `${m.ctr}%` : "--"}</div>
                      </td>

                      {/* Cost */}
                      <td className="py-3.5 px-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                        {m ? `${client.currency} ${m.cost.toFixed(2)}` : "--"}
                      </td>

                      {/* CPA */}
                      <td className="py-3.5 px-3 text-right">
                        <div
                          className={`font-bold ${
                            m && m.cpa > client.highCpaThreshold
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {m && m.conversions > 0 ? `${client.currency} ${m.cpa.toFixed(2)}` : "--"}
                        </div>
                        {m && m.cpa > client.highCpaThreshold && (
                          <div className="text-[10px] text-amber-600 font-semibold">High CPA</div>
                        )}
                      </td>

                      {/* Services breakdown chips */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {m && Object.keys(m.perService).length > 0 ? (
                            Object.entries(m.perService).map(([svc, count]) => (
                              <span
                                key={svc}
                                className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-medium"
                              >
                                {svc}: {count}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-[11px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-3">
                        {client.flags.length > 0 ? (
                          <div className="flex flex-col gap-1 items-start">
                            {client.flags.map((flag) => (
                              <span
                                key={flag}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  flag === "No conversions"
                                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900"
                                    : flag === "High CPA"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                                    : flag === "Report failed"
                                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : isSent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Sent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-medium">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSendWhatsApp(client, isSent)}
                          disabled={sendingId === client.id}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 mx-auto transition ${
                            isSent
                              ? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          {sendingId === client.id ? "Sending..." : isSent ? "Resend" : "Send WA"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= CENTERED MODAL POPUP (Replaces side drawer) ================= */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
          onClick={() => {
            if (!isZoomed) setSelectedClient(null);
          }}
        >
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedClient.name}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  CID: {selectedClient.googleAdsAccount?.customerId} • Specialist: {selectedClient.specialistName}
                </p>
              </div>
              <Link
                href={`/clients/${selectedClient.id}`}
                className="ml-auto mr-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
              >
                Open account page →
              </Link>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* WhatsApp Status & Quick Dispatch Banner */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    WhatsApp Report Status
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedClient.reportLog?.status === "SENT" ? (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Sent to WhatsApp Group
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4" /> Ready to Send (Pending)
                      </span>
                    )}
                    {selectedClient.reportLog?.sentAt && (
                      <span className="text-xs text-gray-400">
                        ({new Date(selectedClient.reportLog.sentAt).toLocaleTimeString()})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSendWhatsApp(selectedClient, true)}
                  disabled={sendingId === selectedClient.id}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition self-stretch sm:self-auto justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingId === selectedClient.id ? "Dispatching..." : "Dispatch to WhatsApp"}
                </button>
              </div>

              {/* Main Content Layout: Card on Left / Caption on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left (7 cols): The exact Google Ads Report Card Image (with Spikes) */}
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Report Card Image (With Multi-Line Spikes)
                    </span>
                    {/* In-Modal Full View Button - NO REDIRECT TO BLANK TAB! */}
                    <button
                      onClick={() => setIsZoomed(true)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Full Overview
                    </button>
                  </div>

                  {/* Image Display */}
                  <div
                    onClick={() => setIsZoomed(true)}
                    className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition group relative"
                  >
                    <img
                      src={`/api/report-card/preview/${selectedClient.id}?date=${date}`}
                      alt="Google Ads Report Card"
                      className="w-full h-auto object-contain block"
                    />
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur">
                        <Maximize2 className="w-3.5 h-3.5" /> Click to Expand
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right (5 cols): WhatsApp Caption & Config Details */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Generated Caption Box with 1-Click Copy */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        WhatsApp Caption
                      </span>
                      <button
                        onClick={() => {
                          const captionText = `📅 ${date}\nTotal Conversion = ${
                            selectedClient.metrics?.conversions ?? 0
                          }\nCall - ${selectedClient.metrics?.callConversions ?? 0} | WhatsApp - ${
                            selectedClient.metrics?.whatsappConversions ?? 0
                          }\nClicks - ${selectedClient.metrics?.clicks ?? 0}\nCTR - ${
                            selectedClient.metrics?.ctr ?? 0
                          }% | Avg CPC - ${selectedClient.currency} ${(
                            selectedClient.metrics?.avgCpc ?? 0
                          ).toFixed(2)}\nCost - ${selectedClient.currency} ${(
                            selectedClient.metrics?.cost ?? 0
                          ).toFixed(2)}`;
                          navigator.clipboard.writeText(captionText);
                          setCopiedCaption(true);
                          setTimeout(() => setCopiedCaption(false), 2000);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        {copiedCaption ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedCaption ? "Copied!" : "Copy Caption"}
                      </button>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 text-xs font-mono text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap leading-relaxed">
                      📅 {date}
                      {"\n"}
                      Total Conversion = {selectedClient.metrics?.conversions ?? 0}
                      {"\n"}
                      Call - {selectedClient.metrics?.callConversions ?? 0} | WhatsApp -{" "}
                      {selectedClient.metrics?.whatsappConversions ?? 0}
                      {"\n"}
                      Clicks - {selectedClient.metrics?.clicks ?? 0}
                      {"\n"}
                      CTR - {selectedClient.metrics?.ctr ?? 0}% | Avg CPC - {selectedClient.currency}{" "}
                      {(selectedClient.metrics?.avgCpc ?? 0).toFixed(2)}
                      {"\n"}
                      Cost - {selectedClient.currency} {(selectedClient.metrics?.cost ?? 0).toFixed(2)}
                      {"\n"}
                      {selectedClient.metrics &&
                        Object.entries(selectedClient.metrics.perService)
                          .map(([s, c]) => `${s} - ${c}`)
                          .join(" | ")}
                    </div>
                  </div>

                  {/* Destination Information */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                    <span className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                      Target Destination
                    </span>
                    <div className="space-y-1.5 text-gray-600 dark:text-gray-400">
                      <div className="truncate">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Group JID: </span>
                        <span className="font-mono text-[11px]">{selectedClient.whatsappGroup?.groupId || "Not configured"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Fallback 1-to-1: </span>
                        <span className="font-mono text-[11px]">{selectedClient.whatsappGroup?.fallbackPhone || "Not configured"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= IN-MODAL FULLSCREEN ZOOM VIEW (No Redirect / Has Back Button) ================= */}
      {isZoomed && selectedClient && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          {/* Top Bar with Clear Back Button */}
          <div
            className="w-full max-w-4xl flex items-center justify-between pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-2 border border-white/20 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Client Overview
            </button>

            <span className="text-white text-sm font-bold">
              {selectedClient.name} • Full Overview Card
            </span>

            <button
              onClick={() => setIsZoomed(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Close full view"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {/* Full High-Res Card */}
          <div
            className="max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/api/report-card/preview/${selectedClient.id}?date=${date}`}
              alt="Google Ads Report Card Full Preview"
              className="w-full h-auto object-contain block"
            />
          </div>
        </div>
      )}
    </div>
  );
}
