import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { AppNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const admin = user.role === "ADMIN";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 backdrop-blur-xl sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/25">
            DR
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900 text-sm">Digital Resolution</div>
            <div className="text-[11px] text-slate-500">Ads Reporting Suite</div>
          </div>
        </div>

        <AppNav admin={admin} />

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Singapore (SGT)
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Daily sync runs at 08:00 SGT</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
          <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                DR
              </div>
              <AppNav admin={admin} compact />
            </div>
            <div className="hidden lg:block text-sm text-slate-500">
              {admin ? "Admin view · all client accounts" : "Your client accounts"}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight hidden sm:block">
                <div className="text-sm font-medium text-slate-900">{user.name}</div>
                <div className="text-[11px] text-slate-500">{admin ? "Admin" : "Specialist"}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                {user.name.trim().charAt(0).toUpperCase()}
              </div>
              <form action="/api/auth/logout" method="post">
                <button
                  title="Log out"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
