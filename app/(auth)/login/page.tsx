import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Komfort POS",
  description: "Sign in to manage inventory, sales, and your POS network.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex font-sans overflow-hidden bg-white">

      {/* ── Left: Branded Panel ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between relative overflow-hidden bg-[#0f0a0b] p-14">

        {/* layered background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#b7102a44_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#7c0a1e33_0%,_transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#b7102a] flex items-center justify-center shadow-lg shadow-red-900/50">
              <span className="material-symbols-outlined text-white text-[22px]">point_of_sale</span>
            </div>
            <span className="text-white text-xl font-black tracking-tight">Komfort</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-[#b7102a] text-[11px] font-black uppercase tracking-[0.3em] mb-4">Retail Intelligence Platform</p>
            <h2 className="text-white text-5xl font-black leading-[1.1] tracking-tight">
              Built for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e84060] to-[#ff8fa3]">
                planet 9
              </span><br />
              who mean<br />business.
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { icon: "inventory_2", label: "Live Inventory" },
              { icon: "receipt_long", label: "Smart Invoicing" },
              { icon: "bar_chart",   label: "Sales Analytics" },
            ].map(f => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <span className="material-symbols-outlined text-[#e84060] text-[24px] mb-2 block">{f.icon}</span>
                <p className="text-white/80 text-[11px] font-bold">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-[11px] font-bold uppercase tracking-widest">
            © 2025 Peekaboo · All rights reserved
          </p>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-12 bg-[#fafafa] relative overflow-hidden">

        {/* subtle background decoration */}
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-red-50 blur-[100px] opacity-60 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-orange-50 blur-[80px] opacity-60 pointer-events-none" />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10 z-10">
          <div className="w-9 h-9 rounded-xl bg-[#b7102a] flex items-center justify-center shadow shadow-red-900/30">
            <span className="material-symbols-outlined text-white text-[18px]">point_of_sale</span>
          </div>
          <span className="text-slate-900 text-lg font-black">Peekaboo</span>
        </div>

        <div className="w-full max-w-[400px] relative z-10">

          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Welcome<br />
              <span className="text-[#b7102a]">back.</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-3">
              Sign in to your admin or cashier account.
            </p>
          </div>

          {/* The form */}
          <LoginForm />

          {/* Footer note */}
          <div className="mt-10 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Personnel Only</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        </div>
      </div>

    </div>
  );
}
