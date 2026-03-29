"use client";
import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import type { InvoiceDoc } from "@/lib/models";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";

export function RecentInvoices() {
  const { user, role } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);

  const filters: InvoiceFilters | undefined = useMemo(() => {
    if (!user) return undefined;
    if (role === "cashier") return { cashierUserId: user.uid };
    return {};
  }, [user, role]);

  useEffect(() => {
    if (!user) return;
    const unsub = observeInvoices((list) => {
      const sorted = [...list].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1)).slice(0, 20);
      setInvoices(sorted);
    }, filters);
    return () => { try { unsub(); } catch { } };
  }, [user, filters]);

  return (
    <div className="bg-white border border-zinc-200/60 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-base font-display font-semibold text-zinc-800">Recent Invoices</h2>
        <Link
          href="/invoices"
          className="h-8 px-3.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 flex items-center hover:bg-zinc-50 transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="px-2 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issued</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="whitespace-nowrap text-zinc-500 text-xs">{new Date(inv.issuedAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/invoices/${inv.id}`} className="hover:text-primary transition-colors">{inv.invoiceNumber || inv.id}</Link>
                </TableCell>
                <TableCell className="text-sm text-zinc-600">{inv.cashierName || inv.cashierUserId}</TableCell>
                <TableCell className="text-right font-semibold">₹{inv.grandTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {inv.status === "paid" ? (
                    <Badge variant="success">Paid</Badge>
                  ) : inv.status === "partial" ? (
                    <Badge variant="warning">Partial</Badge>
                  ) : inv.status === "unpaid" ? (
                    <Badge variant="warning">Unpaid</Badge>
                  ) : (
                    <Badge variant="destructive">Void</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-zinc-400 py-8">No invoices yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
