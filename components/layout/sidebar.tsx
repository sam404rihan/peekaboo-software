"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

/* Material Symbol helper */
function MSIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined text-[20px]", className)}>
      {name}
    </span>
  );
}

const Sidebar = () => {
  const { role, logout } = useAuth();
  const pathname = usePathname();

  const topNavItems =
    role === "admin"
      ? [
          { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
          { href: "/pos", label: "POS Terminal", icon: "point_of_sale" },
          { href: "/products", label: "Inventory", icon: "inventory_2" },
          { href: "/invoices", label: "Invoices", icon: "receipt_long" },
          { href: "/customers", label: "Customers", icon: "group" },
          { href: "/reports", label: "Reports", icon: "bar_chart" },
        ]
      : [
          { href: "/pos", label: "POS", icon: "point_of_sale" },
          { href: "/invoices", label: "Invoices", icon: "receipt_long" },
          { href: "/customers", label: "Customers", icon: "group" },
        ];

  const bottomNavItems = [
    { href: "/settings", label: "Settings", icon: "settings" },
    { href: "/support", label: "Support", icon: "help" },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)) || (href === "/products" && pathname === "/products");

  return (
    <aside className="flex flex-col w-64 h-full bg-[#fcfcfc] border-r border-slate-100 overflow-hidden font-sans shrink-0">
      {/* Brand */}
      <div className="pt-8 pb-6 px-8">
        <h2 className="font-black text-xl text-[#b7102a] tracking-tight leading-none mb-1">
          {role === "admin" ? "Admin Panel" : "Cashier Panel"}
        </h2>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Toy Co. Management</p>
      </div>

      {/* Top Navigation */}
      <nav className="flex-1 mt-4 px-4 space-y-1">
        {topNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-4 rounded-full px-5 py-3 text-[14px] transition-all duration-200",
              isActive(item.href)
                ? "bg-[#fff0f2]/80 text-[#b7102a] font-extrabold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold"
            )}
          >
            <MSIcon
              name={item.icon}
              className={cn(
                isActive(item.href)
                  ? "text-[#b7102a]"
                  : "text-slate-500"
              )}
            />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto px-6 pb-8 space-y-6">
        {/* New Sale CTA - all roles */}
        <Link
            href="/pos"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#b7102a] text-white text-[14px] font-bold shadow-md hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-red-900/20"
          >
            <MSIcon name="add_circle" className="text-[20px]" />
            New Sale
          </Link>
        
        {/* Bottom Navigation */}
        <div className="space-y-1 border-t border-slate-100 pt-6">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 rounded-full px-5 py-2.5 text-[14px] transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold"
            >
              <MSIcon name={item.icon} className="text-slate-500" />
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-4 rounded-full px-5 py-2.5 text-[14px] transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 font-bold"
          >
            <MSIcon name="logout" className="text-slate-500" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
