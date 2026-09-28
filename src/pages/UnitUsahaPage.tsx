// @ts-nocheck — mechanical F2 port from live FE; tighten types in follow-up
import { Pencil, Plus } from "lucide-react"
import { useEffect, useState } from "react";
import api from "@/api/client";
import { useAuth, can } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import Spinner from "@/components/Spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

const BUSINESS_TYPES = [
  { value: "jasa", label: "Jasa" },
  { value: "perdagangan", label: "Perdagangan" },
  { value: "manufaktur", label: "Manufaktur" },
];
const BUSINESS_TYPE_LABEL = Object.fromEntries(BUSINESS_TYPES.map((t) => [t.value, t.label]));

const EMPTY_NEW = { code: "", name: "", business_type: "jasa" };

export default function UnitUsahaPage() {
  const { user } = useAuth();
  // Admin & Direktur can edit; Penasihat & Pengawas are view-only.
  const canWrite = can(user, "admin", "direktur");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUnit, setNewUnit] = useState(EMPTY_NEW);
  const [editing, setEditing] = useState(null); // unit object being edited, or null

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/unit-usaha", { params: { include_inactive: true } });
      setList(r.data || []);
    } catch (er) {
      notify(er.response?.data?.detail || "Gagal memuat daftar unit usaha");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submitNew = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!newUnit.code.trim() || !newUnit.name.trim()) {
      notify("Kode dan nama unit wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await api.post("/unit-usaha", newUnit);
      notify("Unit usaha baru ditambahkan");
      setAddOpen(false);
      setNewUnit(EMPTY_NEW);
      await load();
    } catch (er) {
      notify(er.response?.data?.detail || "Gagal menambah unit usaha");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      await api.patch(`/unit-usaha/${editing.id}`, {
        name: editing.name,
        business_type: editing.business_type,
        active: editing.active,
      });
      notify("Perubahan unit usaha tersimpan");
      setEditing(null);
      await load();
    } catch (er) {
      notify(er.response?.data?.detail || "Gagal menyimpan perubahan unit usaha");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner column size={48} label="Memuat unit usaha..." /></div>;

  return (
    <div className="space-y-6" data-testid="unit-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Struktur Usaha</p>
          <h1 className="font-heading text-3xl font-bold">
            {list.length} Unit Usaha BUMDES
          </h1>
        </div>
        {canWrite && (
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setNewUnit(EMPTY_NEW); }}>
          <DialogTrigger asChild>
            <Button data-testid="unit-add-btn"><Plus className="mr-1"  /> Tambah Unit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Unit Usaha</DialogTitle></DialogHeader>
            <form onSubmit={submitNew} className="space-y-3">
              <div>
                <Label htmlFor="new-code">Kode unit</Label>
                <Input id="new-code" data-testid="unit-new-code" value={newUnit.code}
                  onChange={(e) => setNewUnit((f) => ({ ...f, code: e.target.value }))}
                  placeholder="mis. UU07" />
                <p className="text-xs text-muted-foreground mt-1">
                  Kode tidak bisa diubah lagi setelah dibuat.
                </p>
              </div>
              <div>
                <Label htmlFor="new-name">Nama unit</Label>
                <Input id="new-name" data-testid="unit-new-name" value={newUnit.name}
                  onChange={(e) => setNewUnit((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Jenis usaha</Label>
                <Select value={newUnit.business_type}
                  onValueChange={(v) => setNewUnit((f) => ({ ...f, business_type: v }))}>
                  <SelectTrigger data-testid="unit-new-business-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} data-testid="unit-new-save">
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
        {!canWrite && (
          <p className="text-sm text-muted-foreground" data-testid="unit-usaha-readonly-banner">
            Mode lihat saja — role Anda tidak dapat mengubah Profil Unit Usaha.
          </p>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode</TableHead>
            <TableHead>Nama Unit</TableHead>
            <TableHead>Jenis Usaha</TableHead>
            <TableHead>Status</TableHead>
            {canWrite && <TableHead className="text-right">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((u) => (
            <TableRow key={u.id} data-testid={`unit-row-${u.code}`} className={u.active === false ? "opacity-60" : ""}>
              <TableCell><Badge variant="secondary">{u.code}</Badge></TableCell>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>{BUSINESS_TYPE_LABEL[u.business_type] || u.business_type}</TableCell>
              <TableCell>
                {u.active === false ? <Badge variant="outline">Nonaktif</Badge> : <Badge variant="outline">Aktif</Badge>}
              </TableCell>
              {canWrite && (
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" data-testid={`unit-edit-${u.code}`}
                  onClick={() => setEditing({ ...u })}>
                  <Pencil  className="size-4" />
                </Button>
              </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={canWrite && !!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Unit Usaha {editing?.code}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <Label>Kode unit</Label>
                <Input value={editing.code} disabled />
                <p className="text-xs text-muted-foreground mt-1">
                  Kode tidak bisa diubah karena sudah dipakai di akun/transaksi unit ini.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-name">Nama unit</Label>
                <Input id="edit-name" data-testid="unit-edit-name" value={editing.name}
                  onChange={(e) => setEditing((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Jenis usaha</Label>
                <Select value={editing.business_type}
                  onValueChange={(v) => setEditing((f) => ({ ...f, business_type: v }))}>
                  <SelectTrigger data-testid="unit-edit-business-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="edit-active" data-testid="unit-edit-active" checked={editing.active !== false}
                  onCheckedChange={(v) => setEditing((f) => ({ ...f, active: v }))} />
                <Label htmlFor="edit-active">Unit aktif</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} data-testid="unit-edit-save">
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
