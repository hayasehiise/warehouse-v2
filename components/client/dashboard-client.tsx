"use client";
import { Package, Warehouse, HandHelping } from "lucide-react";

export default function DashboardClient() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Selamat datang di Sistem Manajemen Gudang.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jumlah Barang</p>
              <p className="text-2xl font-semibold text-card-foreground">—</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Warehouse className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stok Barang</p>
              <p className="text-2xl font-semibold text-card-foreground">—</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HandHelping className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pengambilan</p>
              <p className="text-2xl font-semibold text-card-foreground">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
