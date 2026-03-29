"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { listProducts, deleteProduct, updateProduct } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { useAuth } from "@/components/auth/auth-provider";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { observeLowStockProducts } from "@/lib/products";
import { useSearchParams } from "next/navigation";
import { processInventoryExcel } from "@/lib/inventory-bulk";
import { useToast } from "@/components/ui/toast";
import * as XLSX from "xlsx";

const sortProductsBySku = (products: ProductDoc[]) =>
  [...products].sort((a, b) =>
    (a.sku ?? "").toString().localeCompare((b.sku ?? "").toString(), undefined, { sensitivity: "base" })
  );

export default function ProductsListPage() {
  const { role, loading, user } = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Filter States
  const [skuQuery, setSkuQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [stockStatus, setStockStatus] = useState("All Status");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Sync with URL params on mount
  useEffect(() => {
    const status = searchParams.get("status");
    if (status) setStockStatus(status);
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

  const loadData = useCallback(async () => {
    try {
      const [res, cats] = await Promise.all([
        listProducts(),
        listCategories().catch(() => []),
      ]);
      setProducts(sortProductsBySku(res));
      setCategories(cats);
    } catch (e) {
      console.error("Failed to load products:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsub = observeLowStockProducts((items) =>
      setLowStockCount(items.length)
    );
    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this product?")) return;
    setBusy(id);
    try {
      await deleteProduct(id);
      setProducts((p) => sortProductsBySku(p.filter((x) => x.id !== id)));
      toast({ title: "Deleted", description: "Product removed from inventory" });
    } catch (e) {
      console.error("Failed to delete product:", e);
    } finally {
      setBusy(null);
    }
  }, [toast]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (skuQuery.trim()) {
        const term = skuQuery.trim().toLowerCase();
        const matchesSku = (p.sku ?? "").toLowerCase().includes(term);
        const matchesName = p.name.toLowerCase().includes(term);
        if (!matchesSku && !matchesName) return false;
      }
      if (selectedCategory !== "All Categories") {
         if (p.category !== selectedCategory) return false;
      }
      if (stockStatus !== "All Status") {
         const safeStock = parseInt(p.stock as any) || 0;
         const reorder = p.reorderLevel ?? 5;
         if (stockStatus === "In Stock" && safeStock <= reorder) return false;
         if (stockStatus === "Low Stock" && (safeStock === 0 || safeStock > reorder)) return false;
         if (stockStatus === "Out of Stock" && safeStock > 0) return false;
      }
      if (priceMin.trim()) {
         const min = parseFloat(priceMin);
         if (!isNaN(min) && p.unitPrice < min) return false;
      }
      if (priceMax.trim()) {
         const max = parseFloat(priceMax);
         if (!isNaN(max) && p.unitPrice > max) return false;
      }
      return true;
    });
  }, [products, skuQuery, selectedCategory, stockStatus, priceMin, priceMax]);

  useEffect(() => {
    setCurrentPage(1);
  }, [skuQuery, selectedCategory, stockStatus, priceMin, priceMax]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const resetFilters = () => {
     setSkuQuery("");
     setSelectedCategory("All Categories");
     setStockStatus("All Status");
     setPriceMin("");
     setPriceMax("");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await processInventoryExcel(file);
      await loadData(); // Refresh list
      toast({
        title: "Import Complete",
        description: `Added: ${result.added}, Updated: ${result.updated}${result.errors.length ? `. Errors: ${result.errors.length}` : ""}`,
        variant: result.errors.length ? "destructive" : "success",
      });
    } catch (err: any) {
      toast({
        title: "Import Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
     if (filteredProducts.length === 0) return;
     const data = filteredProducts.map(p => ({
        SKU: p.sku || "",
        Name: p.name,
        Category: p.category || "",
        Price: p.unitPrice,
        Stock: p.stock,
        Reorder: p.reorderLevel || 5,
        GST: p.taxRatePct || 0,
        HSN: p.hsnCode || ""
     }));

     const ws = XLSX.utils.json_to_sheet(data);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Inventory");
     XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
     toast({ title: "Export Started", description: "Excel file generated successfully" });
  };

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading warehouse data...</div>;
  if (!user) return null;

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".xlsx,.xls,.csv"
      />
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-black text-red-600 mb-1 block">
            Warehouse & Stock
          </span>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none">
            Inventory<br/>Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                  type="text" placeholder="Search product or SKU..." value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)}
                  className="w-[240px] h-10 pl-11 pr-4 bg-white border border-slate-200 shadow-sm rounded-full text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent focus:ring-red-300 transition-all placeholder:text-slate-400 placeholder:font-medium"
              />
          </div>
          
          <button 
            disabled={isImporting}
            onClick={handleImportClick}
            className="h-10 px-5 rounded-full bg-red-50 text-red-700 flex items-center gap-2 text-[13px] font-bold hover:bg-red-100 transition-colors shrink-0 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">{isImporting ? "sync" : "download"}</span>
            <span className="hidden sm:inline">{isImporting ? "Working..." : "Import"}</span>
          </button>

          <button 
            onClick={handleExport}
            className="h-10 px-5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-2 text-[13px] font-bold hover:bg-slate-200 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            <span className="hidden sm:inline">Export Repo</span>
          </button>

          {role === "admin" && (
            <Link
              href="/products/new"
              className="h-10 px-6 rounded-full bg-[#b7102a] text-white flex items-center gap-2 text-[13px] font-bold hover:brightness-110 transition-colors shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">Add Product</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-[#fff0f2]/60 rounded-[2rem] p-6 flex items-center gap-4 flex-wrap shadow-sm">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
            <div className="relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300">
                <option>All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Status</label>
            <div className="relative">
              <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300">
                <option>All Status</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Out of Stock</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price Range</label>
            <div className="flex items-center gap-2">
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Min" className="w-[80px] h-10 bg-white border-0 rounded-xl px-3 text-sm font-bold text-slate-700 shadow-sm text-center outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
              <span className="text-slate-300 font-bold">-</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max" className="w-[80px] h-10 bg-white border-0 rounded-xl px-3 text-sm font-bold text-slate-700 shadow-sm text-center outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 justify-end h-full pt-5">
             <button onClick={resetFilters} className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors shadow-sm tooltip" title="Clear Filters">
                <span className="material-symbols-outlined text-[18px]">close</span>
             </button>
          </div>
        </div>

        <div className="bg-[#b7102a] rounded-[2rem] p-6 lg:w-[320px] text-white overflow-hidden relative shadow-lg shadow-red-900/10">
          <div className="absolute -right-8 -bottom-10 text-[120px] font-black opacity-[0.08] select-none leading-none pointer-events-none">%</div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-80 mb-2">Global GST</p>
          <div className="text-4xl font-extrabold mb-2 tracking-tight">18.0%</div>
          <p className="text-[11px] font-medium opacity-80 leading-snug pr-8 mt-4">Standard Rate applied across 84% of catalog</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Product Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Price<br/><span className="text-[8px] opacity-70">(INR)</span></th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Stock Level</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">GST Rate</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">inventory_2</span>
                    <p className="font-bold">No products match criteria</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const safeStock = parseInt(p.stock as any) || 0;
                  const maxStockLine = 500; 
                  const percent = Math.min(100, Math.max(2, (safeStock / maxStockLine) * 100));
                  const reorder = p.reorderLevel ?? 5;
                  
                  let stockStatusLabel = "HEALTHY";
                  let barColorClass = "bg-[#22c55e]";
                  let textColorClass = "text-[#22c55e]";
                  
                  if (safeStock === 0) {
                    stockStatusLabel = "OUT OF STOCK";
                    barColorClass = "bg-[#ef4444]";
                    textColorClass = "text-[#ef4444]";
                  } else if (safeStock <= reorder) {
                    stockStatusLabel = "LOW STOCK";
                    barColorClass = "bg-[#f59e0b]";
                    textColorClass = "text-[#f59e0b]";
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-2 border-slate-200/50 text-xl overflow-hidden relative">
                             <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-400 via-slate-100 to-transparent"></div>
                             🧸
                          </div>
                          <div>
                            <Link href={`/products/${p.id}`} className="font-extrabold text-[15px] text-slate-900 hover:text-red-700 transition-colors block leading-tight">
                              {p.name}
                            </Link>
                            <span className="text-[10px] font-black text-slate-400 mt-1 block uppercase tracking-wider">
                              SKU: {p.sku}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {p.category ? (
                           <span className="bg-[#dbeafe] text-[#1e40af] text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider block w-max">
                             {p.category}
                           </span>
                        ) : (
                           <span className="text-slate-300 text-xs font-bold">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-extrabold text-[15px] text-slate-900 tabular-nums">
                          ₹{p.unitPrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3 w-40">
                          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                             <div className={`h-full rounded-full ${barColorClass}`} style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className={`flex flex-col text-[9px] font-black uppercase tracking-widest text-right leading-none ${textColorClass}`}>
                             <span>{stockStatusLabel}</span>
                             <span className="mt-0.5">({safeStock})</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-slate-500 font-bold text-[13px] tabular-nums">
                           {p.taxRatePct !== undefined ? `${p.taxRatePct.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/products/${p.id}`}
                            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Link>
                          {role === "admin" && (
                            <button
                              onClick={() => handleDelete(p.id!)}
                              disabled={busy === p.id}
                              className="w-8 h-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-50"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[18px]">{busy === p.id ? 'hourglass_empty' : 'delete'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-[#fff0f2]/40 border-t-2 border-slate-100 flex items-center justify-between rounded-b-[2rem]">
           <div className="text-[12px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900 font-extrabold">{filteredProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="text-slate-900 font-extrabold">{Math.min(filteredProducts.length, currentPage * itemsPerPage)}</strong> of <strong className="text-slate-900 font-extrabold">{filteredProducts.length}</strong> entries
           </div>
           
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold transition-colors shadow-sm ${
                        page === currentPage 
                        ? 'bg-[#b7102a] text-white border-transparent' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
           </div>
        </div>
      </div>

      {lowStockCount > 0 && (
         <div className="bg-[#ffebec] rounded-[1.5rem] p-5 flex items-center justify-between border border-red-100 shadow-sm mt-8">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#fca5a5]/30 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined select-none text-[22px]">error</span>
               </div>
               <div>
                  <h3 className="font-extrabold text-[15px] text-[#991b1b] mb-0.5">Immediate Action Required</h3>
                  <p className="text-[12px] font-medium text-red-800/80">
                    <strong className="font-extrabold">{lowStockCount} items</strong> are currently below safety threshold levels and require restocking.
                  </p>
               </div>
            </div>
            <button 
              onClick={() => setStockStatus("Low Stock")}
              className="h-10 px-6 rounded-full bg-[#7f1d1d] text-white font-bold text-[13px] hover:bg-[#991b1b] transition-colors shadow-sm whitespace-nowrap"
            >
               Filter List
            </button>
         </div>
      )}
    </div>
  );
}