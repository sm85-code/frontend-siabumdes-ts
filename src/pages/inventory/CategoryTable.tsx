import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import TableShell from "@/components/TableShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryCategory } from "@/types";
import { DEFAULT_CATALOG_ROWS } from "@/lib/catalog";

const BASE = "/api/v1/inventory";
const LOCKED = "Kategori sudah dipakai produk: kode tidak dapat diubah dan kategori tidak dapat dihapus.";
type Row = { key: string; id?: string; code: string; name: string; description: string; has_products?: boolean };
const blank = (): Row => ({ key: crypto.randomUUID(), code: "", name: "", description: "" });
const fromCategory = (c: InventoryCategory): Row => ({ key: c.id, id: c.id, code: c.code, name: c.name, description: c.description || "", has_products: c.has_products });

/** Tab Kategori Produk: input langsung seperti tab Data Manajemen Toko; hanya admin yang dapat mengubah. */
export default function CategoryTable({ categories, isAdmin, onChanged, onError }: {
  categories: InventoryCategory[]; isAdmin: boolean; onChanged: () => Promise<void> | void; onError: (message: string) => void
}) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    setRows((prev) => {
      const saved = categories.map(fromCategory);
      const drafts = prev.filter((r) => !r.id && (r.code || r.name || r.description));
      const out = [...saved, ...drafts];
      while (out.length < DEFAULT_CATALOG_ROWS) out.push(blank());
      return out;
    });
  }, [categories]);

  const patch = (key: string, field: keyof Row, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: field === "code" ? value.toUpperCase() : value } : r)));

  const save = async (row: Row) => {
    if (!isAdmin) return;
    const original = categories.find((c) => c.id === row.id);
    try {
      if (original) {
        const body: Record<string, string> = {};
        if (row.code !== original.code) body.code = row.code;
        if (row.name !== original.name) body.name = row.name;
        if (row.description !== (original.description || "")) body.description = row.description;
        if (!Object.keys(body).length) return;
        if (!row.code.trim() || !row.name.trim()) throw new Error("Kode dan nama kategori wajib diisi.");
        await api.put(`${BASE}/categories/${row.id}`, body);
      } else {
        if (!row.code.trim() || !row.name.trim()) return;
        await api.post(`${BASE}/categories`, { code: row.code, name: row.name, description: row.description || null });
        setRows((rs) => rs.filter((r) => r.key !== row.key));
      }
      await onChanged();
    } catch (e) {
      onError(e instanceof Error && !("response" in e) ? e.message : (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Gagal menyimpan kategori");
      if (original) setRows((rs) => rs.map((r) => (r.key === row.key ? fromCategory(original) : r)));
    }
  };

  const remove = async (row: Row) => {
    if (!row.id) { setRows((rs) => { const left = rs.filter((r) => r.key !== row.key); return left.length < DEFAULT_CATALOG_ROWS ? [...left, blank()] : left; }); return; }
    if (!window.confirm(`Hapus kategori ${row.name}?`)) return;
    try { await api.delete(`${BASE}/categories/${row.id}`); await onChanged(); }
    catch (e) { onError((e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Gagal menghapus kategori"); }
  };

  return (
    <div className="space-y-3" data-testid="category-table">
      {!isAdmin && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Hanya admin yang dapat menambah atau mengubah kategori.</p>}
      <Card className="p-0 overflow-hidden">
        <TableShell minWidth={640}>
          <Table className="toko-table">
            <TableHeader><TableRow>
              <TableHead className="w-12">No.</TableHead><TableHead className="w-36">Kode</TableHead><TableHead>Nama Kategori</TableHead><TableHead>Keterangan</TableHead>{isAdmin && <TableHead className="w-12" />}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell>{i + 1}</TableCell>
                  {isAdmin ? <>
                    <TableCell><Input aria-label={`Kode baris ${i + 1}`} value={r.code} maxLength={32} disabled={r.has_products} title={r.has_products ? LOCKED : undefined} onChange={(e) => patch(r.key, "code", e.target.value)} onBlur={() => void save(r)} /></TableCell>
                    <TableCell><Input aria-label={`Nama kategori baris ${i + 1}`} value={r.name} maxLength={255} onChange={(e) => patch(r.key, "name", e.target.value)} onBlur={() => void save(r)} /></TableCell>
                    <TableCell><Input aria-label={`Keterangan baris ${i + 1}`} value={r.description} maxLength={500} onChange={(e) => patch(r.key, "description", e.target.value)} onBlur={() => void save(r)} /></TableCell>
                    <TableCell>
                      {r.has_products
                        ? <span className="inline-flex" title={LOCKED} aria-label={LOCKED} tabIndex={0}><Button variant="ghost" size="icon" disabled aria-hidden><Trash2 className="size-4" /></Button></span>
                        : <Button variant="ghost" size="icon" aria-label={`Hapus baris ${i + 1}`} title="Hapus baris" onClick={() => void remove(r)}><Trash2 className="size-4" /></Button>}
                    </TableCell>
                  </> : <>
                    <TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.description}</TableCell>
                  </>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </Card>
      {isAdmin && <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blank()])}><Plus className="size-4" /> Tambah baris</Button>}
    </div>
  );
}
