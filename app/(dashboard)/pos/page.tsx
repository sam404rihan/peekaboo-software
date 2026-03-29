"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PosPanel } from "@/components/pos/pos-panel";
import { useAuth } from "@/components/auth/auth-provider";

export default function PosPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
    }
  }, [loading, user, role, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full bg-transparent">
      
      <div className="flex flex-1 flex-col overflow-hidden md:ml-1">
        
        <main className="flex-1 overflow-y-auto pt-2 px-6 md:px-8">
          <PosPanel />
        </main>
      </div>
    </div>
  );
}
