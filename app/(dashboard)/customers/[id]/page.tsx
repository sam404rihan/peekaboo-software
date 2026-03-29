"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import type { CustomerDoc, InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { IoArrowBack } from "react-icons/io5";

interface Metrics {
  visits: number;
  totalSpend: number;
  lastPurchase?: string;
  topItems: Array<{ name: string; qty: number }>;
}

const EMPTY_METRICS: Metrics = {
  visits: 0,
  totalSpend: 0,
  lastPurchase: undefined,
  topItems: [],
};

export default function CustomerDetailPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const customerId = Array.isArray(params?.id)
    ? params.id[0]
    : (params?.id as string);

  const [customer, setCustomer] = useState<CustomerDoc | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesPending, setInvoicesPending] = useState(true);

  // Fetch customer data
  useEffect(() => {
    if (!db || !customerId) return;

    const fetchCustomer = async () => {
      if (db) {
        const ref = doc(db, "Customers", customerId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setCustomer(null);
          return;
        }

        const data = snap.data() as Record<string, unknown>;
        const now = new Date().toISOString();

        const customer: CustomerDoc = {
          id: snap.id,
          name: String(data.name ?? ""),
          phone: typeof data.phone === "string" ? data.phone : undefined,
          email: typeof data.email === "string" ? data.email : undefined,
          notes: typeof data.notes === "string" ? data.notes : undefined,
          kidsDob: typeof data.kidsDob === "string" ? data.kidsDob : undefined,
          active: typeof data.active === "boolean" ? data.active : true,
          gstin: typeof data.gstin === "string" ? data.gstin : undefined,
          loyaltyPoints:
            typeof data.loyaltyPoints === "number"
              ? data.loyaltyPoints
              : undefined,
          totalSpend:
            typeof data.totalSpend === "number" ? data.totalSpend : undefined,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : now,
        };

        setCustomer(customer);
      } else {
        console.error("Firestore is not initialized.");
        // Handle the case where db is undefined, perhaps set an error state or return
      }
    };

    fetchCustomer();
  }, [customerId]);

  // Subscribe to invoices
  useEffect(() => {
    if (!db || !customerId) return;
    if (db) {
      const col = collection(db, "Invoices");
      const q = query(
        col,
        where("customerId", "==", customerId),
        orderBy("issuedAt", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (snap: QuerySnapshot<DocumentData>) => {
          const list = snap.docs.map((doc) =>
            toInvoiceDoc(doc.id, doc.data() as Record<string, unknown>)
          );
          setInvoices(list);
          setInvoicesPending(false);
        },
        (error) => {
          console.error("Failed to fetch invoices:", error);
          setInvoicesPending(false);
        }
      );
      return () => unsubscribe();
    }
  }, [customerId]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!invoices.length) return EMPTY_METRICS;

    const totalSpend = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const itemCounts = new Map<string, { name: string; qty: number }>();

    for (const invoice of invoices) {
      for (const item of invoice.items ?? []) {
        const current = itemCounts.get(item.name) ?? {
          name: item.name,
          qty: 0,
        };
        current.qty += item.quantity;
        itemCounts.set(item.name, current);
      }
    }

    const topItems = Array.from(itemCounts.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      visits: invoices.length,
      totalSpend,
      lastPurchase: invoices[0]?.issuedAt,
      topItems,
    };
  }, [invoices]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-1 flex-col md:ml-1">
        <div className="flex flex-col flex-1">
          
          <main className="flex-1 p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                className="h-9 px-3 text-sm cursor-pointer"
                onClick={() => {
                  window.history.back();
                }}
              >
                <IoArrowBack size={20} />
              </button>
              <h1 className="text-4xl font-serif font-semibold">Customer</h1>
              <div />
            </div>

            {customer ? (
              <div className="space-y-4">
                {/* Customer Info */}
                <div className="border rounded-xl p-4 space-y-1">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {customer.phone || ""}{" "}
                    {customer.email ? `• ${customer.email}` : ""}
                  </div>
                  {customer.kidsDob && (
                    <div className="text-xs text-muted-foreground">
                      Kid&apos;s DOB: {customer.kidsDob}
                    </div>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="Total Spend"
                    value={`₹${metrics.totalSpend.toFixed(2)}`}
                  />
                  <MetricCard label="Visits" value={String(metrics.visits)} />
                  <MetricCard
                    label="Last Purchase"
                    value={
                      metrics.lastPurchase
                        ? new Date(metrics.lastPurchase).toLocaleDateString()
                        : "—"
                    }
                  />
                  <MetricCard
                    label="Loyalty Points"
                    value={String(Math.max(0, customer.loyaltyPoints ?? 0))}
                  />
                </div>

                {/* Top Items */}
                {metrics.topItems.length > 0 && (
                  <div className="border rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      Top Items
                    </div>
                    <ul className="text-sm list-disc pl-6">
                      {metrics.topItems.map((item) => (
                        <li key={item.name}>
                          {item.name} — {item.qty}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-600">Customer not found</div>
            )}

            {/* Purchase History Table */}
            <div className="border rounded-xl p-0">
              <div className="px-4 pt-4 pb-2 text-sm text-muted-foreground">
                Purchase History
              </div>
              <div className="px-4 pb-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Invoice #</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-right">Discount</th>
                      <th className="px-3 py-2 text-right">Grand Total</th>
                      <th className="px-3 py-2">Cashier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(invoice.issuedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">{invoice.invoiceNumber}</td>
                        <td className="px-3 py-2 text-right">
                          ₹{invoice.subtotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          ₹{(invoice.discountTotal ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ₹{invoice.grandTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {invoice.cashierName || invoice.cashierUserId}
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && !invoicesPending && (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-muted-foreground"
                          colSpan={6}
                        >
                          No purchases yet.
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
    </div>
  );
}

// Reusable metric card component
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
