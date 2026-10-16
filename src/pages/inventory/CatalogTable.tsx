import { useEffect, useRef, useState } from "react";
import HelpHint from "@/components/HelpHint";
import { Plus, Trash2 } from "lucide-react";
import api, { fmtRp } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import NumericInput from "@/components/ui/numeric-input";
import TableShell from "@/components/TableShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryCategory, InventoryProduct } from "@/types";
import { DEFAULT_CATALOG_ROWS, buildSku, isRowComplete, shouldAppendRow, skuPrefix, type CatalogRow } from "@/lib/catalog";

const BASE = "/v1/uu05_inventory";
const LOCKED = "Produk sudah memiliki stok/riwayat mutasi: HPP dan hapus terkunci (kategori bisa diubah lewat SKU).";
const COL_NO = "w-12";
const COL_NAME = "min-w-48";
type ApiErr = { response?: { data?: { detail?: unknown } } };
const detail = (e: unknown, fallback: string) => { const d = (e as ApiErr).response?.data?.detail; return typeof d === "string" ? d : fallback; };
const blank = (): CatalogRow => ({ key: crypto.randomUUID(), category_id: "", sku: "", name: "", unit_of_measure: "", cost_price: "0", sell_price: "0" });
const fromProduct = (p: InventoryProduct): CatalogRow => ({
  key: p.id, id: p.id, category_id: p.category_id || "", sku: p.sku, name: p.name, unit_of_measure: p.unit_of_measure || "",
  cost_price: String(Number(p.cost_price || 0)), sell_price: String(Number(p.sell_price || 0)),
});
const isLocked = (p?: InventoryProduct) => Boolean(p && (Number(p.qty_on_hand || 0) !== 0 || p.has_history));
const FIELDS = ["category_id", "name", "unit_of_measure", "cost_price", "sell_price"] as const;

/** Tab Katalog Produk: input langsung, simpan otomatis per kolom. */
export default function CatalogTable({ products, categories, canWrite, unitId, onChanged, onError }: {
  products: InventoryProduct[]; categories: InventoryCategory[]; canWrite: boolean; unitId?: string
  onChanged: () => Promise<void> | void; onError: (message: string) => void
}) {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [skuRow, setSkuRow] = useState<CatalogRow | null>(null);
  const [suffix, setSuffix] = useState("");
  // Ubah kategori + SKU produk tersimpan (juga yang sudah punya riwayat).
  const [editRow, setEditRow] = useState<CatalogRow | null>(null);
  const [editCat, setEditCat] = useState("");
  const [editSuffix, setEditSuffix] = useState("");
  const [editErr, setEditErr] = useState("");
  const openEdit = (row: CatalogRow) => {
    const code = catById.get(row.category_id)?.code || "";
    const pre = skuPrefix(code);
    setEditCat(row.category_id);
    setEditSuffix(row.sku.startsWith(pre) ? row.sku.slice(pre.length) : row.sku.replace(/^KRS\.[^-]*-/, ""));
    setEditErr("");
    setEditRow(row);
  };
  const saveEdit = async () => {
    if (!editRow?.id) return;
    try {
      await api.put(`${BASE}/products/${editRow.id}/sku`, { category_id: editCat, suffix: editSuffix });
      setEditRow(null);
      await onChanged();
    } catch (e) { setEditErr(detail(e, "Gagal mengubah SKU")); }
  };
  const creating = useRef(new Set<string>());
  const byId = new Map(products.map((p) => [p.id, p]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  useEffect(() => {
    setRows((prev) => {
      const drafts = prev.filter((r) => !r.id && (r.category_id || r.sku || r.name || r.unit_of_measure));
      const out = [...products.map(fromProduct), ...drafts];
      while (out.length < DEFAULT_CATALOG_ROWS) out.push(blank());
      return out;
    });
  }, [products]);

  const persist = async (row: CatalogRow) => {
    if (!canWrite) return;
    const original = row.id ? byId.get(row.id) : undefined;
    try {
      if (original) {
        const before = fromProduct(original);
        const body: Record<string, string | number> = {};
        for (const f of FIELDS) if (row[f] !== before[f]) body[f] = f.endsWith("price") ? Number(row[f] || 0) : row[f];
        if (!Object.keys(body).length) return;
        if (!row.name.trim() || !row.unit_of_measure.trim()) throw new Error("Nama dan satuan wajib diisi.");
        await api.put(`${BASE}/products/${row.id}`, body);
      } else {
        if (!isRowComplete(row) || creating.current.has(row.key)) return;
        creating.current.add(row.key);
        try {
          await api.post(`${BASE}/products`, {
            sku: row.sku, name: row.name, category_id: row.category_id, unit_of_measure: row.unit_of_measure,
            cost_price: Number(row.cost_price || 0), sell_price: Number(row.sell_price || 0), unit_usaha_id: unitId,
          });
          setRows((rs) => rs.filter((r) => r.key !== row.key));
        } finally { creating.current.delete(row.key); }
      }
      await onChanged();
    } catch (e) {
      onError(e instanceof Error && !("response" in e) ? e.message : detail(e, "Gagal menyimpan produk"));
      if (original) setRows((rs) => rs.map((r) => (r.key === row.key ? fromProduct(original) : r)));
    }
  };

  const update = (key: string, patch: Partial<CatalogRow>, save = false) => {
    const current = rows.find((r) => r.key === key);
    if (!current) return;
    const next = { ...current, ...patch };
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (save) void persist(next);
  };

  const onRowClick = (index: number) => {
    if (canWrite && shouldAppendRow(rows, index)) setRows((rs) => [...rs, blank()]);
  };

  const openSku = (row: CatalogRow) => {
    if (!canWrite || row.id) return;
    if (!row.category_id) { onError("Pilih Kategori terlebih dahulu sebelum mengisi SKU."); return; }
    const code = catById.get(row.category_id)?.code || "";
    setSuffix(row.sku.startsWith(skuPrefix(code)) ? row.sku.slice(skuPrefix(code).length) : "");
    setSkuRow(row);
  };

  const remove = async (row: CatalogRow) => {
    if (!row.id) { setRows((rs) => { const left = rs.filter((r) => r.key !== row.key); return left.length < DEFAULT_CATALOG_ROWS ? [...left, blank()] : left; }); return; }
    if (!window.confirm(`Hapus produk ${row.name}?`)) return;
    try { await api.delete(`${BASE}/products/${row.id}`); await onChanged(); }
    catch (e) { onError(detail(e, "Gagal menghapus produk")); }
  };

  const skuCode = skuRow ? catById.get(skuRow.category_id)?.code || "" : "";
  return (
    <div className="space-y-3" data-testid="catalog-table">
      <Card className="p-0 overflow-hidden">
        <TableShell minWidth={980}>
          <Table className="toko-table">
            <TableHeader><TableRow>
              <TableHead className={COL_NO}>No.</TableHead><TableHead className="min-w-44">Kategori</TableHead><TableHead className="min-w-40">SKU</TableHead>
              <TableHead className={COL_NAME}>Nama</TableHead><TableHead className="min-w-24">Satuan</TableHead>
              <TableHead className="num min-w-32">HPP</TableHead><TableHead className="num min-w-32">Harga jual</TableHead>
              <TableHead className="num"><span className="inline-flex items-center gap-0.5">Stok<HelpHint label="Tentang Stok dan Nilai">Stok awal selalu 0; stok bertambah melalui Stock In. Nilai = HPP × Stok.</HelpHint></span></TableHead><TableHead className="num min-w-32">Nilai</TableHead>
              {canWrite && <TableHead className="w-12 border-0 bg-transparent" aria-label="Aksi" />}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const p = r.id ? byId.get(r.id) : undefined;
                const locked = isLocked(p);
                return (
                  <TableRow key={r.key} onClick={() => onRowClick(i)} onFocusCapture={() => onRowClick(i)}>
                    <TableCell className={COL_NO}>{i + 1}</TableCell>
                    {canWrite ? <>
                      <TableCell>
                        <Select value={r.category_id || undefined} disabled={Boolean(r.id)} onValueChange={(v) => update(r.key, { category_id: v, ...(r.id ? {} : { sku: "" }) }, Boolean(r.id))}>
                          <SelectTrigger aria-label={`Kategori baris ${i + 1}`} className="h-10 w-full" title={r.id ? "Ubah kategori lewat SKU" : undefined}><SelectValue placeholder="Pilih" /></SelectTrigger>
                          <SelectContent position="popper">{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <button type="button" className="input h-10 w-full text-left" aria-label={`SKU baris ${i + 1}`}
                          title={r.id ? "Klik untuk ubah kategori/SKU" : "Klik untuk mengisi SKU"} onClick={() => (r.id ? openEdit(r) : openSku(r))}>
                          {r.sku || <span className="italic text-muted-foreground/60">klik untuk input</span>}
                        </button>
                        {p?.has_history && <span className="text-[11px] text-muted-foreground" title="Produk sudah punya riwayat transaksi/mutasi">Riwayat</span>}
                      </TableCell>
                      <TableCell className={COL_NAME}><Input aria-label={`Nama baris ${i + 1}`} value={r.name} maxLength={255} onChange={(e) => update(r.key, { name: e.target.value })} onBlur={() => void persist(r)} /></TableCell>
                      <TableCell><Input aria-label={`Satuan baris ${i + 1}`} value={r.unit_of_measure} maxLength={20} placeholder="pcs" onChange={(e) => update(r.key, { unit_of_measure: e.target.value })} onBlur={() => void persist(r)} /></TableCell>
                      <TableCell><NumericInput className="input h-10 w-full text-right" aria-label={`HPP baris ${i + 1}`} min={0} step="any" value={r.cost_price} disabled={locked} title={locked ? LOCKED : undefined} onChange={(e) => update(r.key, { cost_price: e.target.value })} onBlur={() => void persist(r)} /></TableCell>
                      <TableCell><NumericInput className="input h-10 w-full text-right" aria-label={`Harga jual baris ${i + 1}`} min={0} step="any" value={r.sell_price} onChange={(e) => update(r.key, { sell_price: e.target.value })} onBlur={() => void persist(r)} /></TableCell>
                    </> : <>
                      <TableCell>{p?.category_name || "-"}</TableCell><TableCell className="font-medium">{r.sku}{p?.has_history && <div className="text-[11px] font-normal text-muted-foreground">Riwayat</div>}</TableCell>
                      <TableCell className={COL_NAME}>{r.name}</TableCell><TableCell>{r.unit_of_measure}</TableCell>
                      <TableCell className="num">{p ? fmtRp(Number(p.cost_price)) : ""}</TableCell><TableCell className="num">{p ? fmtRp(Number(p.sell_price)) : ""}</TableCell>
                    </>}
                    <TableCell className="num" title="Stok hanya bertambah melalui Stock In">{p ? p.qty_on_hand : 0}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p?.stock_value || 0))}</TableCell>
                    {canWrite && (
                      <TableCell className="border-0 bg-transparent">
                        {locked
                          ? <Button variant="ghost" size="icon" className="opacity-40" aria-label={`Hapus baris ${i + 1} terkunci: ${LOCKED}`} title={LOCKED} onClick={(e) => { e.stopPropagation(); onError(LOCKED); }}><Trash2 className="size-4" /></Button>
                          : <Button variant="ghost" size="icon" aria-label={`Hapus baris ${i + 1}`} title="Hapus baris" onClick={(e) => { e.stopPropagation(); void remove(r); }}><Trash2 className="size-4" /></Button>}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      </Card>
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blank()])}><Plus className="size-4" /> Tambah baris</Button>
          <span className="text-xs text-muted-foreground">{categories.length ? "Pilih Kategori, lalu klik SKU untuk mengisi kode produk baru." : "Belum ada kategori produk. Minta admin menambahkannya di Kategori Produk."}</span>
        </div>
      )}
      <Dialog open={Boolean(editRow)} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ubah Kategori & SKU</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
            <Select value={editCat || undefined} onValueChange={setEditCat}>
              <SelectTrigger aria-label="Kategori baru" className="h-10 w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent position="popper">{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2">
      <span className="font-medium whitespace-nowrap">{skuPrefix(catById.get(editCat)?.code || "")}</span>
              <Input aria-label="Sufiks SKU" value={editSuffix} maxLength={40} onChange={(e) => setEditSuffix(e.target.value.toUpperCase().replace(/\s/g, ""))} />
            </div>
            <p className="text-sm">{editRow?.sku} → <span className="font-medium">{buildSku(catById.get(editCat)?.code || "", editSuffix)}</span></p>
            {byId.get(editRow?.id || "")?.has_history && <p className="help-text">Produk sudah punya riwayat; transaksi tetap tertaut, dokumen terbit tetap memakai SKU lama.</p>}
            {editErr && <p role="alert" className="text-sm text-destructive">{editErr}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button><Button type="submit" disabled={!editCat || !editSuffix.trim()}>Simpan</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(skuRow)} onOpenChange={(open) => { if (!open) setSkuRow(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Kode SKU : KRS.{skuCode}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!skuRow || !suffix.trim()) return;
            update(skuRow.key, { sku: buildSku(skuCode, suffix) }, true);
            setSkuRow(null);
          }}>
            <div className="flex items-center gap-2">
              <span className="font-medium whitespace-nowrap">{skuPrefix(skuCode)}</span>
              <Input autoFocus aria-label="Kode SKU" value={suffix} maxLength={40} onChange={(e) => setSuffix(e.target.value.toUpperCase().replace(/\s/g, ""))} />
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSkuRow(null)}>Batal</Button><Button type="submit" disabled={!suffix.trim()}>Simpan</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
