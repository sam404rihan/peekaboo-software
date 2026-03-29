"use client";
import { ProductForm } from "@/components/products/product-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FaArrowLeft } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      window.location.href = "/login";
    }
  }, [loading, user, role]);

  if (loading || !user) return null;

  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-col flex-1">
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-6 mb-8">
            <Button
              variant="ghost" 
              onClick={() => router.push("/products")}
              className="w-12 h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center p-0"
            >
              <FaArrowLeft size={18} />
            </Button>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">New Product</h1>
          </div>
          <ProductForm
            mode="create"
            onSaved={() => (window.location.href = "/products")}
          />
        </main>
      </div>
    </div>
  );
}
