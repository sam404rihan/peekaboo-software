"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { getProduct } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import { categoryCode } from "@/lib/models";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { incrementPrintedCount } from "@/lib/products";
import { adjustStock } from "@/lib/pos";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast";

function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
  const catName = p.category;
  let code = categoryCode(catName);
  if (catName) {
    const match = categories.find(c => c.active && c.name.toLowerCase() === catName.toLowerCase());
    if (match?.code) code = match.code.toUpperCase();
  }
  return `PB|${code}|${p.sku}`;
}

export default function PrintLabelsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const productId = Array.isArray(params?.productId) ? params.productId[0] : (params?.productId as string);
  const labelsCount = useMemo(() => {
    const raw = Array.isArray(params?.labels) ? params.labels[0] : (params?.labels as string);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(300, Math.max(1, Math.floor(n)));
  }, [params]);

  const [prod, setProd] = React.useState<ProductDoc | null>(null);
  const [categories, setCategories] = React.useState<CategoryDoc[]>([]);
  const svgRefs = React.useRef<Array<SVGSVGElement | null>>([]);
  const [barcodesReady, setBarcodesReady] = useState(false);

  const handledRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (!productId) return;
      const [p, cats] = await Promise.all([getProduct(productId), listCategories()]);
      setProd(p);
      setCategories(cats.filter(c => c.active));
    })();
  }, [productId]);

  const codeText = useMemo(() => (prod ? encodeBarcode(prod, categories) : ""), [prod, categories]);

  useEffect(() => {
    if (!codeText) return;
    const opts = {
      format: "CODE128B",
      displayValue: false,
      margin: 0,
      height: 30,
      width: 2
    } as const;

    let drawn = 0;
    svgRefs.current.forEach((el) => { if (el) { JsBarcode(el, codeText, opts as any); drawn++; } });
    if (drawn > 0) {
      requestAnimationFrame(() => setBarcodesReady(true));
    }
  }, [codeText, labelsCount]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page { size: 50mm 25mm; margin: 0; }
        html, body { width: 50mm; height: 25mm; margin: 0; padding: 0; }
        body * { visibility: hidden !important; }
        #labels-print-root, #labels-print-root * { visibility: visible !important; }
        #labels-print-root { position: absolute; inset: 0; margin: 0; padding: 0; }
      }
      #labels-print-root { background: #fff; }
    `;
    document.head.appendChild(style);

    const prevTitle = document.title;
    document.title = " ";
    const t = setTimeout(() => { if (barcodesReady) window.print(); }, 300);

    const handleAfterPrint = async () => {
      if (handledRef.current) return;
      handledRef.current = true;
      try {
        let didPrint = false;
        try { didPrint = window.confirm('Did the labels print successfully?'); } catch { }
        if (didPrint && prod?.id) {
          await incrementPrintedCount(prod.id, labelsCount);
          await adjustStock({ productId: prod.id, delta: labelsCount, reason: 'receive', userId: user?.uid, note: 'barcode-print' });
          toast({ title: 'Stock updated', description: `${labelsCount} added for printing`, variant: 'success' });
        }
      } finally {
        try { window.close(); } catch { }
        router.replace('/settings');
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => { document.title = prevTitle; clearTimeout(t); window.removeEventListener('afterprint', handleAfterPrint); document.head.removeChild(style); };
  }, [labelsCount, prod?.id, router, user?.uid, barcodesReady]);

  if (!prod) return <div className="p-6 text-sm">Preparing labels…</div>;

  const labels = Array.from({ length: labelsCount });
  const showMrp = prod.mrp && prod.mrp > prod.unitPrice;

  return (
    <div id="labels-print-root">
      {labels.map((_, idx) => (
        <div
          key={idx}
          className="mx-auto"
          style={{
            width: '50mm',
            height: '25mm',
            padding: '1mm',
            boxSizing: 'border-box',
            pageBreakAfter: 'always',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            overflow: 'hidden'
          }}
        >
          {/* 1. Name */}
          <div style={{
            fontSize: '8pt',
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            textAlign: 'center'
          }}>
            {prod.name}
          </div>

          {/* 2. SP - Price */}
          <div style={{
            fontSize: '11pt',
            fontWeight: 400,
            lineHeight: 1,
            marginTop: '0.5mm'
          }}>
            SP - ₹{prod.unitPrice.toFixed(0)}
          </div>

          {/* 3. Barcode */}
          <div style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <svg ref={(el) => { svgRefs.current[idx] = el; }} style={{ width: '90%', height: '100%' }} />
          </div>

          {/* 4. MRP & SKU */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            lineHeight: 1
          }}>
            <div style={{ fontSize: '6pt' }}>
              {showMrp ? (
                <span style={{ textDecoration: 'line-through' }}>
                  MRP ₹{prod!.mrp!.toFixed(0)}
                </span>
              ) : <span>&nbsp;</span>}
            </div>

            <div style={{ fontSize: '6pt', fontFamily: 'monospace' }}>
              {codeText}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}