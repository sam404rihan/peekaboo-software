"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategory } from "@/lib/categories";
import { useToast } from "@/components/ui/toast";
import { IoArrowBack } from "react-icons/io5";

export default function NewCategoryPage() {
  const { user, role, loading } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultHsnCode, setDefaultHsnCode] = useState("");
  const [defaultTaxRatePct, setDefaultTaxRatePct] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== "admin")
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Admin access required.
      </div>
    );
  async function onSave() {
    if (!name || !code) {
      toast({
        title: "Validation",
        description: "Name and Code are required",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const parsedTax = parseFloat(defaultTaxRatePct);
      await createCategory({
        name,
        code,
        description: description || undefined,
        active,
        defaultHsnCode: defaultHsnCode.trim() || undefined,
        defaultTaxRatePct:
          defaultTaxRatePct.trim() === "" || Number.isNaN(parsedTax)
            ? undefined
            : parsedTax,
      });
      toast({
        title: "Category created",
        description: `${name} (${code})`,
        variant: "success",
      });
      window.location.href = "/settings/categories";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="link"
          onClick={() => (window.location.href = "/settings/categories")}
          className="h-12 cursor-pointer"
        >
          <IoArrowBack className="mr-2"/>
        </Button>
        <h1 className="text-xl font-semibold">New Category</h1>
        <div />
      </div>
      <div className="border rounded-xl p-4 space-y-3 max-w-xl">
        <div>
          <label className="text-sm">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Code</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CLO"
          />
        </div>
        <div>
          <label className="text-sm">Description (optional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm">Default HSN Code (optional)</label>
          <Input
            value={defaultHsnCode}
            onChange={(e) => setDefaultHsnCode(e.target.value)}
            placeholder="e.g., 9503"
          />
        </div>
        <div>
          <label className="text-sm">Default GST % (optional)</label>
          <Input
            type="number"
            step="0.01"
            value={defaultTaxRatePct}
            onChange={(e) => setDefaultTaxRatePct(e.target.value)}
            placeholder="e.g., 12"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label htmlFor="active" className="text-sm">
            Active
          </label>
        </div>
        <Button onClick={onSave} disabled={busy}>
          Save
        </Button>
      </div>
    </div>
  );
}
