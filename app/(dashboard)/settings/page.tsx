"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

type TabKey =
  | "store"
  | "receipt"
  | "categories"
  | "barcodes"
  | "inventory"
  | "audit"
  | "offers"
  | "offline"
  | "receive"
  | "coupons";

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
}

const TAB_CONFIG: Record<TabKey, string> = {
  store: "./business-profile/page",
  receipt: "./receipt-template/page",
  categories: "./categories/page",
  barcodes: "./barcodes/page",
  inventory: "./inventory-logs/page",
  offers: "./offers/page",
  offline: "./offline-queue/page",
  audit: "./audit-trail/page",
  receive: "./receive/page",
  coupons: "./coupons/page",
};

export default function SettingsIndexPage() {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("store");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const items: TabItem[] = useMemo(
    () => [
      { key: "store", label: "Store Profile", icon: "storefront" },
      { key: "receipt", label: "Receipts", icon: "receipt" },
      { key: "categories", label: "Categories", icon: "category" },
      { key: "barcodes", label: "Barcodes", icon: "qr_code" },
      { key: "receive", label: "Receive Stock", icon: "inventory_2" },
      { key: "inventory", label: "Inventory Logs", icon: "history" },
      { key: "audit", label: "Audit Log", icon: "manage_history" },
      ...(role === "admin" ? [
        { key: "offers" as TabKey, label: "Active Offers", icon: "local_offer" },
        { key: "coupons" as TabKey, label: "Coupon Codes", icon: "confirmation_number" },
      ] : []),
      { key: "offline", label: "Sync Queue", icon: "cloud_sync" },
    ],
    [role]
  );

  const Section = useMemo(
    () =>
      dynamic(() => import(TAB_CONFIG[tab]).then((m) => m.default), {
        ssr: false,
        loading: () => <div className="p-12 text-center text-slate-400 font-bold opacity-50">Loading interface...</div>,
      }),
    [tab]
  );

  if (loading) return <div className="p-8 font-bold text-slate-400">Loading configurations...</div>;
  if (!user) return null;

  return (
    <div className="flex w-full h-full font-sans text-slate-900 mx-auto max-w-[1200px]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-4 md:p-8">
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-10 pl-2">
             <div className="w-[52px] h-[52px] rounded-2xl bg-[#fdf0e3] shadow-inner shadow-orange-100 flex items-center justify-center border border-[#fce3c8]">
                <span className="text-[26px]">⚙️</span>
             </div>
             <div>
                <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mb-0.5 leading-none">Settings</h1>
                <p className="text-[14px] font-medium text-[#6b7280]">Configure your store, printers, and inventory logic</p>
             </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Sidebar Navigation */}
            <nav className="w-full lg:w-64 shrink-0 bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100/60 sticky top-4">
                 <ul className="flex flex-col gap-2">
                 {items.map((item) => {
                   const isActive = tab === item.key;
                   return (
                     <li key={item.key}>
                       <button
                         type="button"
                         onClick={() => setTab(item.key)}
                         className={cn(
                           "flex items-center gap-3 w-full text-left px-5 py-3.5 rounded-2xl text-[14px] transition-all font-bold",
                           isActive
                             ? "border border-orange-200 text-[#e03c18] shadow-sm bg-white"
                             : "border border-transparent text-[#4b5563] hover:bg-slate-50 hover:text-slate-900"
                         )}
                       >
                         {item.icon && (
                           <span className={cn("material-symbols-outlined text-[18px]", isActive ? "text-[#e03c18]" : "text-slate-400")}>
                             {item.icon}
                           </span>
                         )}
                         {item.label}
                       </button>
                     </li>
                   );
                 })}
               </ul>
            </nav>

            {/* Dynamic Content Segment */}
            <div className="flex-1 min-w-0 bg-white rounded-[2rem] border border-slate-100/60 shadow-sm p-8 md:p-10 mb-12 min-h-[600px]">
               <div className="animate-in fade-in duration-500 slide-in-from-bottom-1 h-full">
                 <Section />
               </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
