import FormDialog from '@/components/FormDialog'
import { Key, Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { ROLE_LABELS } from "@/config/roles"
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { getApiError } from "@/api/client";
import { useAuth } from "@/lib/auth";
import { notify, notifySuccess, notifyError } from "@/lib/feedback";
import { useConfirm } from "@/components/ConfirmProvider";
import { useSort } from "@/lib/useSort";
import Spinner from "@/components/Spinner";
import TableShell from "@/components/TableShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import type { Role, UnitUsaha, User } from "@/types";
import { fetchClosedPeriods } from "@/api/reports";
import { createUserSchema, type CreateUserFormValues } from "@/schemas/users";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin Utama" },
  { value: "direktur", label: "Direktur" },
  { value: "bendahara", label: "Bendahara" },
  { value: "pengelola", label: "Pengelola Unit" },
  { value: "pengawas", label: "Pengawas (read-only)" },
  { value: "penasihat", label: "Penasihat (read-only)" },
];

const ROLE_BADGE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default", direktur: "secondary", bendahara: "secondary",
  pengelola: "outline", pengawas: "secondary", penasihat: "secondary",
};

type EditUserForm = {
  name: string
  username: string
  email: string
  role: Role | ""
  unit_usaha_id: string
}

const EMPTY_CREATE: CreateUserFormValues = {
  username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "",
};


export default function UsersPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [formError, setFormError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<UnitUsaha[]>([]);
  const [show, setShow] = useState(false);
  const [showResetFor, setShowResetFor] = useState<string | null>(null);
  const [showLockFor, setShowLockFor] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({ name: "", username: "", email: "", role: "", unit_usaha_id: "" });
  const [lockPeriods, setLockPeriods] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<{ period: string; group: string }[]>([]);
  const [newPw, setNewPw] = useState("");
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: EMPTY_CREATE,
  });
  const createRole = createForm.watch("role");

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, un] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<UnitUsaha[]>("/unit-usaha"),
      ]);
      setUsers(u.data ?? []); setUnits(un.data ?? []);
    } catch (er) {
      notifyError(getApiError(er, "Gagal memuat data pengguna"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchClosedPeriods().then(setClosed).catch(() => {}); }, []);

  const onCreateUser = async (values: CreateUserFormValues) => {
    setFormError('');
    try {
      await api.post("/auth/register", {
        ...values,
        unit_usaha_id: values.role === "pengelola" ? values.unit_usaha_id : null,
      });
      setShow(false);
      createForm.reset(EMPTY_CREATE);
      void load();
      notifySuccess("Pengguna berhasil ditambahkan.");
    } catch (er: unknown) {
      setFormError(getApiError(er, "Gagal"));
    }
  };

  const openEdit = (u: User) => {
    setFormError('');
    setEditingUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email || "",
      role: u.role,
      unit_usaha_id: u.unit_usaha_id || "",
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError('');
    try {
      await api.put(`/users/${editingUser.id}`, {
        ...editForm,
        unit_usaha_id: editForm.role === "pengelola" ? editForm.unit_usaha_id : null,
      });
      setEditingUser(null);
      void load();
      notifySuccess("Pengguna berhasil diperbarui.");
    } catch (er: unknown) {
      setFormError(getApiError(er, "Gagal memperbarui pengguna"));
    }
  };

  const del = async (id: string) => {
    if (!(await confirm({ title: "Hapus pengguna", description: "Pengguna akan dihapus dan tidak dapat dipulihkan.", confirmLabel: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/users/${id}`);
      void load();
      notifySuccess("Pengguna berhasil dihapus.");
    } catch (er: unknown) {
      notifyError(getApiError(er, "Gagal menghapus pengguna"));
    }
  };

  const resetPw = async (e: FormEvent) => {
    e.preventDefault();
    if (!showResetFor) return;
    if (newPw.length < 6) { notify("Password minimal 6 karakter"); return; }
    setFormError('');
    try {
      await api.post(`/users/${showResetFor}/reset-password`, { new_password: newPw });
      setShowResetFor(null); setNewPw("");
      void load();
      notifySuccess("Password berhasil direset.");
    } catch (er: unknown) {
      setFormError(getApiError(er, "Gagal reset"));
    }
  };

  // ---- Period Access Control ----
  const openLock = (u: User) => {
    setShowLockFor(u.id);
    setLockPeriods(new Set(u.blocked_periods || []));
  };
  const togglePeriod = (ym: string) => {
    setLockPeriods(prev => {
      const n = new Set(prev);
      if (n.has(ym)) n.delete(ym); else n.add(ym);
      return n;
    });
  };
  const saveLock = async () => {
    if (!showLockFor) return;
    try {
      await api.put(`/users/${showLockFor}/blocked-periods`, {
        blocked_periods: Array.from(lockPeriods),
      });
      setShowLockFor(null); setLockPeriods(new Set());
      void load();
      notifySuccess("Periode terkunci berhasil disimpan.");
    } catch (er: unknown) {
      notifyError(getApiError(er, "Gagal menyimpan"));
    }
  };

  const isAdmin = user?.role === "admin";
  const userSort = useSort(users as unknown as Record<string, unknown>[], "name", "asc");
  const sortedUsers = userSort.sorted as unknown as User[];

  if (!isAdmin) {
    return (
      <Card data-testid="users-page-forbidden">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Akses Ditolak</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Hanya Admin Utama yang berwenang melihat dan mengelola pengguna.
          </p>
        </CardContent>
      </Card>
    );
  }

  const actionButtons = (u: User) => (
    <div className="flex gap-1">
      <Button
        data-testid={`btn-edit-${u.id}`}
        onClick={() => openEdit(u)}
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
        title="Edit Pengguna"
      >
        <Pencil  className="size-4" />
      </Button>
      {u.role !== "admin" && (
        <Button
          data-testid={`btn-lock-${u.id}`}
          onClick={() => openLock(u)}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Kunci Periode"
        >
          <Lock  className="size-4" />
        </Button>
      )}
      <Button
        data-testid={`btn-reset-${u.id}`}
        onClick={() => { setFormError(''); setShowResetFor(u.id); }}
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
        title="Reset Password"
      >
        <Key  className="size-4" />
      </Button>
      {u.id !== user.id && (
        <Button
          data-testid={`btn-del-${u.id}`}
          onClick={() => del(u.id)}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Hapus"
        >
          <Trash2  className="size-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Manajemen Akses (Admin Utama)</p>
          <h1 className="font-heading text-3xl font-bold page-h1">Kelola Pengguna</h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Password tidak dapat dilihat. Gunakan Reset Password jika pengguna kehilangan akses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="btn-new-user" onClick={() => { setFormError(''); createForm.reset(EMPTY_CREATE); setShow(true); }}>
            <Plus  className="size-4" /> Tambah Pengguna
          </Button>
        </div>
      </div>

      {show && (
        <FormDialog title={'Tambah Pengguna'} onClose={() => { setShow(false); createForm.reset(EMPTY_CREATE); setFormError(''); }} error={formError}>{({ cancel, run }) => <>
          <Card className="fade-in">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Tambah Pengguna Baru</CardTitle>
            </CardHeader>
            <form onSubmit={e => void run(() => createForm.handleSubmit(onCreateUser)(e))}>
              <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nama Lengkap</Label>
                  <Input aria-invalid={Boolean(createForm.formState.errors.name)} {...createForm.register("name")} />
                  {createForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input aria-invalid={Boolean(createForm.formState.errors.username)} {...createForm.register("username")} />
                  {createForm.formState.errors.username && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" aria-invalid={Boolean(createForm.formState.errors.email)} {...createForm.register("email")} />
                  {createForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="text" placeholder="min. 6 karakter" aria-invalid={Boolean(createForm.formState.errors.password)} {...createForm.register("password")} />
                  {createForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Controller
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {createRole === "pengelola" && (
                  <div className="space-y-1.5">
                    <Label>Unit Usaha</Label>
                    <Controller
                      control={createForm.control}
                      name="unit_usaha_id"
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-unit-usaha">
                            <SelectValue placeholder="— pilih unit —" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map(u => <SelectItem key={u.id} value={u.id}>{u.code} - {u.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {createForm.formState.errors.unit_usaha_id && (
                      <p className="text-xs text-destructive">{createForm.formState.errors.unit_usaha_id.message}</p>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="sm:col-span-2 justify-end gap-2">
                <Button type="button" onClick={cancel} variant="outline">Batal</Button>
                <Button type="submit" data-testid="btn-save-user" disabled={createForm.formState.isSubmitting}>Simpan</Button>
              </CardFooter>
            </form>
          </Card>
        </>}</FormDialog>
      )}

      {editingUser && (
        <FormDialog title={'Ubah Pengguna'} onClose={() => { setEditingUser(null); setFormError(''); }} error={formError}>{({ cancel, run }) => <>
          <Card className="fade-in" data-testid="edit-user-form">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Edit Pengguna: {editingUser.name}</CardTitle>
            </CardHeader>
            <form onSubmit={e => { e.preventDefault(); void run(() => saveEdit(e)); }}>
              <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nama Lengkap</Label>
                  <Input required value={editForm.name}
                         onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input required value={editForm.username}
                         onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" required value={editForm.email}
                         onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select required value={editForm.role}
                          onValueChange={(v) => setEditForm({ ...editForm, role: v as Role })}>
                    <SelectTrigger data-testid="edit-select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editForm.role === "pengelola" && (
                  <div className="space-y-1.5">
                    <Label>Unit Usaha</Label>
                    <Select required value={editForm.unit_usaha_id}
                            onValueChange={(v) => setEditForm({ ...editForm, unit_usaha_id: v })}>
                      <SelectTrigger data-testid="edit-select-unit-usaha">
                        <SelectValue placeholder="— pilih unit —" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(u => <SelectItem key={u.id} value={u.id}>{u.code} - {u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button type="button" onClick={cancel} variant="outline">Batal</Button>
                <Button type="submit" data-testid="btn-save-edit">Simpan Perubahan</Button>
              </CardFooter>
            </form>
          </Card>
        </>}</FormDialog>
      )}

      {showResetFor && (
        <FormDialog title={'Reset Password'} onClose={() => { setShowResetFor(null); setNewPw(""); setFormError(''); }} error={formError} compact>{({ cancel, run }) => <>
          <Card className="fade-in" data-testid="reset-pw-form">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Key className="text-primary"  /> Reset Password
              </CardTitle>
            </CardHeader>
            <form onSubmit={e => { e.preventDefault(); void run(() => resetPw(e)); }}>
              <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Password Sementara</Label>
                  <Input data-testid="reset-pw-input" type="password" required minLength={8} maxLength={72}
                         value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min. 8 karakter" />
                  <p className="text-xs mt-2 text-muted-foreground">
                    Pengguna wajib mengganti password ini setelah login berikutnya.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button type="button" onClick={cancel} variant="outline">Batal</Button>
                <Button type="submit" data-testid="btn-confirm-reset">Reset &amp; Simpan</Button>
              </CardFooter>
            </form>
          </Card>
        </>}</FormDialog>
      )}

      {showLockFor && (() => {
        const targetUser = users.find(u => u.id === showLockFor);
        const targetGroup = units.find(x => x.id === targetUser?.unit_usaha_id)?.code || "BUMDES";
        const isClosed = (ym: string) => closed.some(c => c.period === ym && c.group === targetGroup);
        const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
        const YEARS = [];
        for (let y = 2022; y <= 2030; y++) YEARS.push(y);
        return (
          <Card className="fade-in" data-testid="lock-periods-form">
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Lock className="text-destructive"  /> Kunci Periode Transaksi
                </CardTitle>
                <p className="text-sm mt-1 text-muted-foreground">
                  Untuk <b>{targetUser?.name}</b>. Bulan yang dicentang akan diblokir dari input/edit/hapus transaksi. Bulan bertanda <b>•</b> bukunya sudah ditutup ({targetGroup}), jadi sudah terkunci untuk semua orang.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setShowLockFor(null); setLockPeriods(new Set()); }} variant="outline">Batal</Button>
                <Button data-testid="btn-save-lock" onClick={saveLock}>Simpan</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {YEARS.map(y => {
                const yearMonths = MONTHS.map((_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
                const allBlocked = yearMonths.every(m => lockPeriods.has(m));
                return (
                  <div key={y} className="rounded-lg p-3 bg-muted/40 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">Tahun {y}</span>
                      <Button
                        data-testid={`lock-year-${y}`}
                        onClick={() => {
                          setLockPeriods(prev => {
                            const n = new Set(prev);
                            if (allBlocked) yearMonths.forEach(m => n.delete(m));
                            else yearMonths.forEach(m => n.add(m));
                            return n;
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                      >
                        {allBlocked ? "Buka Semua" : "Kunci Semua"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MONTHS.map((mn, i) => {
                        const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
                        const blocked = lockPeriods.has(ym);
                        return (
                          <Button key={ym}
                                  type="button"
                                  data-testid={`lock-${ym}`}
                                  onClick={() => togglePeriod(ym)}
                                  variant={blocked ? "destructive" : "outline"}
                                  size="sm"
                                  title={isClosed(ym) ? `Buku ${targetGroup} sudah ditutup` : undefined}
                                  className="h-7 px-0 text-xs font-normal data-[blocked=true]:font-semibold">
                            {mn}{isClosed(ym) ? " •" : ""}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-10 flex justify-center">
            <Spinner label="Memuat pengguna..." />
          </div>
        ) : (
          <TableShell
            minWidth={720}
            data-testid="users-table"
          >
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow>
                  <TableHead {...userSort.headerProps("name")}>Nama{userSort.sortIndicator("name")}</TableHead>
                  <TableHead {...userSort.headerProps("username")}>Username{userSort.sortIndicator("username")}</TableHead>
                  <TableHead {...userSort.headerProps("email")}>Email{userSort.sortIndicator("email")}</TableHead>
                  <TableHead {...userSort.headerProps("role")}>Role{userSort.sortIndicator("role")}</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Periode Terkunci</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((u) => {
                  const blockedCnt = (u.blocked_periods || []).length;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? "outline"}>{ROLE_LABELS[u.role] || u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{units.find(x => x.id === u.unit_usaha_id)?.code || "-"}</TableCell>
                      <TableCell className="text-xs" data-testid={`blocked-count-${u.id}`}>
                        {blockedCnt > 0
                          ? <Badge variant="secondary">{blockedCnt} bulan</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {actionButtons(u)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
