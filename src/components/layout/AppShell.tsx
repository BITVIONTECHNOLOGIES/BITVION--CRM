import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ADMIN_ONLY_PREFIXES } from "@/components/layout/nav";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useCrm } from "@/context/CrmContext";
import { ROLE_LABEL } from "@/data/catalog";
import { isAdmin } from "@/lib/scope";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { session, previewRole, setPreviewRole } = useAuth();
  const { state } = useCrm();
  const me = state.users.find((user) => user.id === session?.userId);
  const admin = isAdmin(me);
  const blocked = !admin && ADMIN_ONLY_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        {admin && previewRole !== "administrator" ? (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
            <span>Previewing the interface as {ROLE_LABEL[previewRole]}. Akhil Shijo remains the signed-in administrator.</span>
            <button type="button" className="font-medium underline" onClick={() => setPreviewRole("administrator")}>
              Return to Administrator
            </button>
          </div>
        ) : null}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div key={pathname} className="page-enter mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
            {blocked ? <Navigate to="/" replace /> : <Outlet />}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
