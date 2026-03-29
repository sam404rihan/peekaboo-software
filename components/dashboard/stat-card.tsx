import { cn } from "@/lib/utils";
import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
  className?: string;
}

export function StatCard({ label, value, icon, subtext, className }: StatCardProps) {
  return (
    <div className={cn("relative overflow-hidden p-6 flex flex-col gap-3 border border-zinc-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 group", className)}>
      {/* Background ghost icon */}
      <div className="absolute -right-3 -top-3 text-[72px] text-zinc-100/60 group-hover:text-primary/5 transition-colors pointer-events-none select-none">
        {icon || "📊"}
      </div>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:bg-primary/5 group-hover:text-primary transition-colors">
          {icon || "📊"}
        </div>
        <p className="text-[11px] tracking-widest font-semibold text-zinc-400 uppercase mt-3">{label}</p>
        <h3 className="text-2xl font-display font-bold text-zinc-900 tracking-tight mt-0.5">{value}</h3>
        {subtext && <p className="text-xs font-medium text-zinc-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
