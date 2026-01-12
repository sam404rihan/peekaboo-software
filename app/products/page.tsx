"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { listProducts, deleteProduct, updateProduct } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";

const sortProductsBySku = (products: ProductDoc[]) =>
  [...products].sort((a, b) =>
    (a.sku ?? "").toString().localeCompare((b.sku ?? "").toString(), undefined, { sensitivity: "base" })
  );

export default function ProductsListPage() {
  const { role, loading, user } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [skuQuery, setSkuQuery] = useState("");
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [loading, user]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [res, cats] = await Promise.all([
          listProducts(),
          listCategories().catch(() => []),
        ]);
        if (mounted) {
          setProducts(sortProductsBySku(res));
          setCategories(cats);
        }
      } catch (e) {
        console.error("Failed to load products:", e);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this product?")) return;
    setBusy(id);
    try {
      await deleteProduct(id);
      setProducts((p) => sortProductsBySku(p.filter((x) => x.id !== id)));
    } catch (e) {
      console.error("Failed to delete product:", e);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleCategoryChange = useCallback(
    async (product: ProductDoc, categoryName: string | undefined) => {
      if (!product.id) return;
      const selected = categories.find((c) => c.name === categoryName);
      setUpdatingId(product.id);
      try {
        const updates: Partial<ProductDoc> = { category: categoryName };
        if (selected?.defaultHsnCode) updates.hsnCode = selected.defaultHsnCode;
        if (selected?.defaultTaxRatePct !== undefined && !Number.isNaN(selected.defaultTaxRatePct)) {
          updates.taxRatePct = selected.defaultTaxRatePct;
        }
        await updateProduct(product.id, updates);
        setProducts((prev) =>
          sortProductsBySku(
            prev.map((p) => (p.id !== product.id ? p : { ...p, ...updates }))
          )
        );
      } catch (err) {
        console.error("Failed to update product category:", err);
      } finally {
        setUpdatingId(null);
      }
    },
    [categories]
  );

  const filteredProducts = useMemo(() => {
    if (!skuQuery.trim()) return products;
    const term = skuQuery.trim().toLowerCase();
    return products.filter((p) => (p.sku ?? "").toLowerCase().includes(term));
  }, [products, skuQuery]);

  // Updated column count (Admin: 10, User: 8)
  const columnCount = role === "admin" ? 10 : 8;

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-7xl space-y-4">
            <div>
              <h1 className="text-5xl font-bold
              text-gray-900 font-serif">Products</h1>
              <p className="mt-1 text-xs text-gray-500">
                Manage your product catalog, track stock levels, and update product details.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Search by SKU"
                value={skuQuery}
                onChange={(e) => setSkuQuery(e.target.value)}
                aria-label="Search products by SKU"
                className="sm:w-72"
              />
              {role === "admin" ? (
                <Link href="/products/new" aria-label="Create product" title="Create product">
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Plus className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  disabled
                  title="Only admins can create products"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">SKU</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Category</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">HSN Code</th>
                    {/* Renamed Header */}
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Selling Price</th>
                    {/* New Header */}
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">MRP</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">GST %</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Stock</th>
                    {role === "admin" && (
                      <>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">Printed</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-6 py-3 text-gray-700">{p.sku}</td>
                        <td className="px-6 py-3">
                          {role === "admin" ? (
                            <select
                              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm disabled:bg-gray-100"
                              value={p.category ?? ""}
                              onChange={(e) => handleCategoryChange(p, e.target.value || undefined)}
                              disabled={updatingId === p.id}
                            >
                              <option value="">Unassigned</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name} ({c.code})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">{p.category || "-"}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-700">{p.hsnCode || "-"}</td>
                        {/* Selling Price */}
                        <td className="px-6 py-3 text-gray-700">₹{p.unitPrice.toFixed(2)}</td>
                        {/* New MRP Column */}
                        <td className="px-6 py-3 text-gray-500">
                          {p.mrp ? `₹${p.mrp.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-6 py-3 text-gray-700">{p.taxRatePct ?? 0}</td>
                        <td className="px-6 py-3 text-gray-700">{p.stock}</td>
                        {role === "admin" && <td className="px-6 py-3 text-gray-700">{p.printedCount ?? 0}</td>}
                        {role === "admin" && (
                          <td className="space-x-2 px-6 py-3">
                            <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline">
                              Edit
                            </Link>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id!)}
                              disabled={busy === p.id}
                              className="text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columnCount} className="px-6 py-8 text-center text-gray-500">
                        {products.length === 0 ? "No products yet." : "No products match this SKU."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}