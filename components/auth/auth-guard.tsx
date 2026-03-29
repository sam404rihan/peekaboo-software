"use client";
import React from "react";
import { useAuth } from "./auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fff8f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-zinc-200 border-t-red-600 rounded-full animate-spin"></div>
          <p className="text-sm text-zinc-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  return <>{children}</>;
}
