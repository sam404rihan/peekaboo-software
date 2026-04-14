"use client";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth/auth-provider";
import { signOut } from "@/lib/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropdownPanel } from "@/components/ui/dropdown-panel";
import { observeLowStockProducts } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
}

export function Topbar() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [lowItems, setLowItems] = useState<ProductDoc[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const lowCount = lowItems.length;
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!user || !role) return;
    const unsub = observeLowStockProducts(setLowItems);
    return () => unsub?.();
  }, [user, role]);

  const handleClickOutside = useCallback(
    (e: MouseEvent, ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setter(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => handleClickOutside(e, notifRef, setNotifOpen);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, handleClickOutside]);

  const handleSignOut = useCallback(() => {
    signOut().finally(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#fcfcfc] border-b border-slate-100 h-20 flex items-center shrink-0">
      <div className="flex items-center justify-between gap-4 w-full px-8">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              placeholder="Search specific toys..."
              className="w-full h-10 pl-11 pr-4 rounded-full bg-white border border-slate-100 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-1 focus:ring-red-200 focus:border-red-200 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-5">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              className="relative p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <MSIcon name="notifications" className="text-[22px]" />
              {isAdmin && lowCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[8px] h-2 w-2 rounded-full bg-[#b7102a] ring-2 ring-[#fcfcfc]" />
              )}
            </button>

            {notifOpen && (
              <DropdownPanel className="absolute right-0 w-80 mt-2 z-50">
                <div className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100 flex items-center justify-between">
                  Alerts
                  {lowCount > 0 && (
                    <span className="text-[10px] font-black tracking-widest uppercase text-white bg-[#b7102a] px-2 py-0.5 rounded-full">
                      {lowCount} New
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-auto">
                  {lowItems.length === 0 ? (
                    <div className="text-sm text-slate-400 font-medium px-4 py-8 text-center flex flex-col items-center">
                      <MSIcon name="check_circle" className="text-[32px] text-slate-200 mb-2" />
                      All operations normal
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {lowItems.map((product) => (
                        <li key={product.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-[#fce8ec] flex items-center justify-center shrink-0">
                            <MSIcon name="warning" className="text-[16px] text-[#b7102a]" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-[13px] font-bold text-slate-800 truncate">{product.name}</div>
                            <div className="text-[11px] font-medium text-slate-500">{product.stock} left in stock</div>
                          </div>
                          <button
                            className="text-[11px] font-extrabold text-[#b7102a] uppercase tracking-wider hover:underline shrink-0"
                            onClick={() => isAdmin ? router.push(`/products/${product.id}`) : router.push("/products")}
                          >
                            View
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </DropdownPanel>
            )}
          </div>

          <Link href="/guide" className="p-1.5 text-slate-500 hover:text-[#b7102a] transition-colors" title="User Guide">
            <MSIcon name="help" className="text-[22px]" />
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 shrink-0" />

          {/* User Menu */}
          <div className="flex items-center gap-3 pl-1">
             <button onClick={handleSignOut} className="text-[13px] font-extrabold text-[#b7102a] hover:text-red-800 transition-colors uppercase tracking-widest hidden sm:block">
                Logout
             </button>
             <Avatar
               fallback={(user?.email?.[0] || "U").toUpperCase()}
               className="bg-[#1e293b] text-white font-black hover:ring-2 hover:ring-red-200 hover:ring-offset-2 transition-all cursor-pointer"
               title={user?.email || "User profile"}
             />
          </div>
        </div>
      </div>
    </header>
  );
}
