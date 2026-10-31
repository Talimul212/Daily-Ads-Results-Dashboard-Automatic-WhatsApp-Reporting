"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Key,
  Layers,
  MessageSquare,
  ArrowLeft,
  X,
  User,
  Users,
  Clock,
  Power,
  AlertTriangle,
  DownloadCloud,
} from "lucide-react";
import Link from "next/link";

interface Specialist {
  id: string;
  name: string;
  email: string;
  role: string;
  clientCount?: number;
  hasPassword?: boolean;
}

interface ClientSetting {
  id: string;
  name: string;
  specialistName: string;
  specialistId: string | null;
  timezone: string;
  currency: string;
  active: boolean;
  highCpaThreshold: number;
  requiresApproval: boolean;
  googleAdsAccounts: {
    id: string;
    customerId: string;
    loginCustomerId: string | null;
    status: string;
  }[];
  campaignServiceMaps: {
    id: string;
    campaignNamePattern: string;
    serviceLabel: string;
  }[];
  conversionActionMaps: {
    id: string;
    conversionActionName: string;
    type: string;
  }[];
  whatsappGroup: {
    id: string;
    groupId: string | null;
    fallbackPhone: string | null;
    status: string;
  } | null;
}

export default function SettingsPage() {
  const [clients, setClients] = useState<ClientSetting[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showAddClientModal, setShowAddClientModal] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientSetting | null>(null);

  const [showSpecialistModal, setShowSpecialistModal] = useState<boolean>(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);

  const [deleteClientTarget, setDeleteClientTarget] = useState<ClientSetting | null>(null);
  const [deleteSpecialistTarget, setDeleteSpecialistTarget] = useState<Specialist | null>(null);
  const [reassignSpecialistId, setReassignSpecialistId] = useState<string>("");

  // Specialist Form State
  const [specialistForm, setSpecialistForm] = useState({
    id: "",
    name: "",
    email: "",
    role: "SPECIALIST",
    password: "",
  });

  // Client Form State
  const [clientForm, setClientForm] = useState({
    id: "",
    name: "",
    customerId: "",
    loginCustomerId: "",
    specialistName: "",
    specialistId: "",
    highCpaThreshold: "60",
    requiresApproval: false,
    active: true,
    whatsappGroupId: "",
    whatsappFallbackPhone: "+65",
    campaignPattern1: "",
    serviceLabel1: "",
    campaignPattern2: "",
    serviceLabel2: "",
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, specRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/specialists"),
      ]);
      const settingsData = await settingsRes.json();
      const specData = await specRes.json();

      if (settingsData.success) {
        setClients(settingsData.clients);
      }
      if (specData.success) {
        setSpecialists(specData.specialists);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ================= MCC IMPORT =================
  const [importing, setImporting] = useState<string | null>(null);
  const handleImportFromMcc = async () => {
    setImporting("Reading MCC…");
    try {
      const res = await fetch("/api/accounts/import", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        showToast(`Import failed: ${data.error}`);
        return;
      }
      if (data.created.length === 0) {
        showToast(`All ${data.found} MCC accounts are already linked.`);
        return;
      }

      // Backfill 30 days for everyone: 3 API operations per account in total.
      setImporting(`Backfilling ${data.created.length} new accounts…`);
      const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
      showToast(`Imported ${data.created.length} accounts and loaded their last 30 days.`);
      await fetchSettings();
    } catch (err: any) {
      showToast(`Import failed: ${err.message}`);
    } finally {
      setImporting(null);
    }
  };

  // ================= SPECIALIST CRUD =================
  const openAddSpecialist = () => {
    setEditingSpecialist(null);
    setSpecialistForm({ id: "", name: "", email: "", role: "SPECIALIST", password: "" });
    setShowSpecialistModal(true);
  };

  const openEditSpecialist = (spec: Specialist) => {
    setEditingSpecialist(spec);
    setSpecialistForm({
      id: spec.id,
      name: spec.name,
      email: spec.email,
      role: spec.role,
      password: "",
    });
    setShowSpecialistModal(true);
  };

  const handleSaveSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingSpecialist);
      const url = "/api/specialists";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(specialistForm),
      });

      const data = await res.json();
      if (data.success) {
        setShowSpecialistModal(false);
        showToast(
          isEdit
            ? `Specialist "${specialistForm.name}" updated successfully!`
            : `Specialist "${specialistForm.name}" added successfully!`
        );
        await fetchSettings();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSpecialist = async () => {
    if (!deleteSpecialistTarget) return;
    try {
      let url = `/api/specialists?id=${deleteSpecialistTarget.id}`;
      if (reassignSpecialistId) {
        url += `&reassignToId=${reassignSpecialistId}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteSpecialistTarget(null);
        showToast(`Specialist "${deleteSpecialistTarget.name}" removed.`);
        await fetchSettings();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ================= CLIENT CRUD =================
  const openAddClient = () => {
    setEditingClient(null);
    setClientForm({
      id: "",
      name: "",
      customerId: "",
      loginCustomerId: "",
      specialistName: specialists[0]?.name || "",
      specialistId: specialists[0]?.id || "",
      highCpaThreshold: "60",
      requiresApproval: false,
      active: true,
      whatsappGroupId: "",
      whatsappFallbackPhone: "+65",
      campaignPattern1: "",
      serviceLabel1: "",
      campaignPattern2: "",
      serviceLabel2: "",
    });
    setShowAddClientModal(true);
  };

  const openEditClient = (c: ClientSetting) => {
    setEditingClient(c);
    const acc = c.googleAdsAccounts[0];
    const wa = c.whatsappGroup;
    const cmp1 = c.campaignServiceMaps[0];
    const cmp2 = c.campaignServiceMaps[1];

    setClientForm({
      id: c.id,
      name: c.name,
      customerId: acc?.customerId || "",
      loginCustomerId: acc?.loginCustomerId || "",
      specialistName: c.specialistName || "",
      specialistId: c.specialistId || "",
      highCpaThreshold: String(c.highCpaThreshold || 60),
      requiresApproval: c.requiresApproval,
      active: c.active,
      whatsappGroupId: wa?.groupId || "",
      whatsappFallbackPhone: wa?.fallbackPhone || "+65",
      campaignPattern1: cmp1?.campaignNamePattern || "",
      serviceLabel1: cmp1?.serviceLabel || "",
      campaignPattern2: cmp2?.campaignNamePattern || "",
      serviceLabel2: cmp2?.serviceLabel || "",
    });
    setShowAddClientModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingClient);
      const url = "/api/settings";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        id: clientForm.id || undefined,
        name: clientForm.name,
        customerId: clientForm.customerId,
        loginCustomerId: clientForm.loginCustomerId || undefined,
        specialistName: clientForm.specialistName,
        specialistId: clientForm.specialistId || undefined,
        timezone: "Asia/Singapore",
        currency: "SGD",
        highCpaThreshold: clientForm.highCpaThreshold,
        requiresApproval: clientForm.requiresApproval,
        active: clientForm.active,
        whatsappGroupId: clientForm.whatsappGroupId || undefined,
        whatsappFallbackPhone: clientForm.whatsappFallbackPhone || undefined,
        campaignMaps: [
          { pattern: clientForm.campaignPattern1, label: clientForm.serviceLabel1 },
          { pattern: clientForm.campaignPattern2, label: clientForm.serviceLabel2 },
        ].filter((m) => m.pattern && m.label),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddClientModal(false);
        showToast(
          isEdit
            ? `Client "${clientForm.name}" updated successfully!`
            : `Client "${clientForm.name}" created successfully!`
        );
        await fetchSettings();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (client: ClientSetting) => {
    const nextStatus = !client.active;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, active: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          nextStatus
            ? `Client "${client.name}" is now ACTIVE (auto-reports resume).`
            : `Client "${client.name}" PAUSED (daily reports stopped).`
        );
        await fetchSettings();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClient = async () => {
    if (!deleteClientTarget) return;
    try {
      const res = await fetch(`/api/settings?id=${deleteClientTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteClientTarget(null);
        showToast(`Client "${deleteClientTarget.name}" deleted.`);
        await fetchSettings();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            Agency, Specialist & Client Settings
          </h1>
          <p className="text-xs text-gray-500">
            Full management: Add, update, pause, or remove specialists and Singapore client accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openAddSpecialist}
            className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition border border-gray-300 dark:border-gray-700"
          >
            <User className="w-3.5 h-3.5 text-blue-500" /> + Add Specialist
          </button>
          <button
            onClick={handleImportFromMcc}
            disabled={importing !== null}
            title="Create a client for every enabled account under your MCC"
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 font-semibold text-xs flex items-center gap-1.5 transition border border-indigo-200 disabled:opacity-60"
          >
            <DownloadCloud className={`w-3.5 h-3.5 ${importing ? "animate-pulse" : ""}`} />
            {importing ?? "Import from MCC"}
          </button>
          <button
            onClick={openAddClient}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add New Client
          </button>
        </div>
      </div>

      {/* ================= SPECIALISTS TEAM SECTION ================= */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">
              Google Ads Specialists Team
            </h2>
            <span className="text-xs text-gray-400">({specialists.length} Specialists)</span>
          </div>
          <button
            onClick={openAddSpecialist}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Specialist
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {specialists.map((spec) => (
            <div
              key={spec.id}
              className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs hover:border-gray-300 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                  {spec.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    {spec.name}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-700 font-normal">
                      {spec.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">{spec.email}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Assigned: <strong>{spec.clientCount || 0} clients</strong>
                    {spec.hasPassword === false && (
                      <span className="ml-1.5 text-amber-600 font-semibold">· No login yet (set a password)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditSpecialist(spec)}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                  title="Edit Specialist"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setDeleteSpecialistTarget(spec);
                    setReassignSpecialistId(specialists.find((s) => s.id !== spec.id)?.id || "");
                  }}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 transition"
                  title="Remove Specialist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= CLIENT CONFIGURATIONS LIST ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-gray-900 dark:text-white">
            Client Accounts & Routing ({clients.length})
          </h2>
          <span className="text-xs text-gray-500">
            {clients.filter((c) => c.active).length} Active • {clients.filter((c) => !c.active).length} Paused
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading configurations...</div>
          ) : (
            clients.map((client) => {
              const acc = client.googleAdsAccounts[0];
              const wa = client.whatsappGroup;

              return (
                <div
                  key={client.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm space-y-4 transition ${
                    client.active
                      ? "border-gray-200 dark:border-gray-700"
                      : "border-gray-300 dark:border-gray-800 opacity-60 bg-gray-50/50"
                  }`}
                >
                  {/* Client Summary Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                          client.active
                            ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600"
                            : "bg-gray-100 dark:bg-gray-800 border border-gray-300 text-gray-400"
                        }`}
                      >
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-gray-900 dark:text-white">
                            {client.name}
                          </h3>
                          {!client.active && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              PAUSED (No reports sent)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3 mt-0.5">
                          <span>
                            Specialist:{" "}
                            <strong className="text-gray-700 dark:text-gray-300">
                              {client.specialistName || "Unassigned"}
                            </strong>
                          </span>
                          <span>
                            Timezone: <strong className="text-gray-700 dark:text-gray-300">{client.timezone}</strong>
                          </span>
                          <span>
                            High CPA: <strong className="text-gray-700 dark:text-gray-300">${client.highCpaThreshold}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Pause toggle, Edit, Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleToggleActive(client)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                          client.active
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 hover:bg-gray-200"
                        }`}
                        title="Toggle Active/Paused"
                      >
                        <Power className="w-3.5 h-3.5" />
                        {client.active ? "Active" : "Paused"}
                      </button>

                      <button
                        onClick={() => openEditClient(client)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>

                      <button
                        onClick={() => setDeleteClientTarget(client)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 transition"
                        title="Delete Client"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Technical Configuration Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Google Ads Mapping */}
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700">
                      <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-2">
                        <Key className="w-3.5 h-3.5 text-blue-500" /> Google Ads Credentials
                      </div>
                      <div className="space-y-1 text-gray-600 dark:text-gray-400">
                        <div>CID: <span className="font-mono text-gray-900 dark:text-gray-100 font-semibold">{acc?.customerId || "None"}</span></div>
                        <div>MCC ID: <span className="font-mono text-gray-900 dark:text-gray-100">{acc?.loginCustomerId || "Direct Access"}</span></div>
                        <div>Review Mode: <span className="font-semibold text-gray-800 dark:text-gray-200">{client.requiresApproval ? "Manual Review" : "Auto-Send"}</span></div>
                      </div>
                    </div>

                    {/* Campaign Service Maps */}
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700">
                      <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-2">
                        <Layers className="w-3.5 h-3.5 text-amber-500" /> Campaign Service Rules
                      </div>
                      <div className="space-y-1">
                        {client.campaignServiceMaps.length > 0 ? (
                          client.campaignServiceMaps.map((map) => (
                            <div key={map.id} className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                              <span className="font-mono text-[11px] truncate max-w-[130px]">{map.campaignNamePattern}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900">
                                {map.serviceLabel}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">Default general service</span>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Target Destination */}
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700">
                      <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-2">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Destination
                      </div>
                      <div className="space-y-1 text-gray-600 dark:text-gray-400">
                        <div className="truncate">Group ID: <span className="font-mono text-gray-900 dark:text-gray-100">{wa?.groupId || "Not set"}</span></div>
                        <div>Fallback Phone: <span className="font-mono text-gray-900 dark:text-gray-100">{wa?.fallbackPhone || "Not set"}</span></div>
                        <div>Status: <span className="text-emerald-600 font-semibold">{client.active ? "Ready" : "Paused"}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= MODAL: ADD / EDIT SPECIALIST ================= */}
      {showSpecialistModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                {editingSpecialist ? "Edit Specialist" : "Add New Specialist"}
              </h3>
              <button
                onClick={() => setShowSpecialistModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialist} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Ong"
                  value={specialistForm.name}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Agency Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="david@digitalresolution.com"
                  value={specialistForm.email}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Role
                </label>
                <select
                  value={specialistForm.role}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                >
                  <option value="SPECIALIST">Ads Specialist</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Specialists only see clients assigned to them. Admins see everything.
                </p>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  {editingSpecialist ? "New password" : "Login password"}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required={!editingSpecialist}
                  placeholder={editingSpecialist ? "Leave blank to keep the current password" : "At least 8 characters"}
                  value={specialistForm.password}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowSpecialistModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> {editingSpecialist ? "Update Specialist" : "Save Specialist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE SPECIALIST (With Reassignment) ================= */}
      {deleteSpecialistTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Remove Specialist &quot;{deleteSpecialistTarget.name}&quot;?
              </h3>
            </div>
            <p className="text-xs text-gray-500">
              This specialist currently manages <strong>{deleteSpecialistTarget.clientCount || 0} clients</strong>. You can reassign these accounts to another team member:
            </p>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Reassign clients to:
              </label>
              <select
                value={reassignSpecialistId}
                onChange={(e) => setReassignSpecialistId(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
              >
                <option value="">Leave Unassigned</option>
                {specialists
                  .filter((s) => s.id !== deleteSpecialistTarget.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDeleteSpecialistTarget(null)}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSpecialist}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CLIENT ================= */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingClient ? `Edit Client: ${editingClient.name}` : "Add New Singapore Client"}
              </h3>
              <button
                onClick={() => setShowAddClientModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Client / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Plumbing Singapore"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Assigned Specialist
                  </label>
                  <select
                    value={clientForm.specialistId || ""}
                    onChange={(e) => {
                      const sel = specialists.find((s) => s.id === e.target.value);
                      setClientForm({
                        ...clientForm,
                        specialistId: e.target.value,
                        specialistName: sel ? sel.name : "",
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                  >
                    <option value="">Unassigned</option>
                    {specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Google Ads Account */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Google Ads Customer ID (CID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123-456-7890"
                    value={clientForm.customerId}
                    onChange={(e) => setClientForm({ ...clientForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    MCC Login Customer ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 991-234-5678"
                    value={clientForm.loginCustomerId}
                    onChange={(e) => setClientForm({ ...clientForm, loginCustomerId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none font-mono"
                  />
                </div>
              </div>

              {/* WhatsApp Config */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    WhatsApp Group ID (JID)
                  </label>
                  <input
                    type="text"
                    placeholder="1203630...@g.us"
                    value={clientForm.whatsappGroupId}
                    onChange={(e) => setClientForm({ ...clientForm, whatsappGroupId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    1-to-1 Fallback Phone (+65...)
                  </label>
                  <input
                    type="text"
                    placeholder="+6591234567"
                    value={clientForm.whatsappFallbackPhone}
                    onChange={(e) => setClientForm({ ...clientForm, whatsappFallbackPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Threshold & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    High CPA Threshold ($ SGD)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={clientForm.highCpaThreshold}
                    onChange={(e) => setClientForm({ ...clientForm, highCpaThreshold: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Account Status
                  </label>
                  <select
                    value={clientForm.active ? "true" : "false"}
                    onChange={(e) => setClientForm({ ...clientForm, active: e.target.value === "true" })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                  >
                    <option value="true">Active (Reports Run Automatically)</option>
                    <option value="false">Paused (No Reports / Inactive)</option>
                  </select>
                </div>
              </div>

              {/* Service Mapping Rules */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">
                  Campaign Service Mapping Rules (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Pattern 1 (e.g. HMS|Handyman)"
                    value={clientForm.campaignPattern1}
                    onChange={(e) => setClientForm({ ...clientForm, campaignPattern1: e.target.value })}
                    className="px-2.5 py-1.5 border rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
                  />
                  <input
                    type="text"
                    placeholder="Service Label 1 (e.g. HM)"
                    value={clientForm.serviceLabel1}
                    onChange={(e) => setClientForm({ ...clientForm, serviceLabel1: e.target.value })}
                    className="px-2.5 py-1.5 border rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
                  />
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 block">
                    Specialist Review Required
                  </span>
                  <span className="text-[11px] text-gray-500">
                    If enabled, report is staged in dashboard for review before sending.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={clientForm.requiresApproval}
                  onChange={(e) => setClientForm({ ...clientForm, requiresApproval: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" /> {editingClient ? "Update Client" : "Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CLIENT CONFIRMATION ================= */}
      {deleteClientTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Delete Client &quot;{deleteClientTarget.name}&quot;?
              </h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Are you sure you want to permanently delete this client? All Google Ads account mappings, campaign rules, and report logs will be permanently deleted.
              <br /><br />
              <em>Tip: If this client only temporarily paused their service, you can simply click &quot;Active/Paused&quot; instead of deleting.</em>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDeleteClientTarget(null)}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
