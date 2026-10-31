"use client";

import { useParams } from "next/navigation";
import { AccountReport } from "@/components/AccountReport";

// Client-facing, read-only report. The token in the URL is the only credential.
export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const base = `/api/portal/${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen">
      <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto h-full px-4 lg:px-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            DR
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Digital Resolution</div>
            <div className="text-[11px] text-slate-500">Your ads report</div>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto p-4 lg:p-8">
        <AccountReport
          mode="client"
          dataUrl={(start, end) => `${base}?start=${start}&end=${end}`}
          campaignsUrl={(_client, start, end) => `${base}?campaigns=1&start=${start}&end=${end}`}
        />
      </main>
    </div>
  );
}
