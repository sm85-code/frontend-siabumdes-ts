import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { API, getApiError } from "@/api/client"
import api from "@/api/client";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";
import { useSort } from "@/lib/useSort";
import TableShell from "@/components/TableShell";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Account, TransactionType, UnitUsaha } from "@/types";
import { accountFormSchema, type AccountFormValues } from "@/schemas/accounts";

const CAT_LABELS: Record<string, string> = {
  aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas",
  pendapatan: "Pendapatan", hpp: "Harga Pokok Penjualan", beban: "Beban",
};

// Harus persis sama dengan data/coa_taxonomy.xlsx di backend (sm85-arch) --
// itu satu-satunya sumber kebenaran. Backend memvalidasi pasangan
// kategori/subkategori terhadap file yang sama (lihat _validate_category_pair
// di master_data_router.py), jadi daftar di sini wajib disamakan setiap kali
// coa_taxonomy.xlsx berubah, supaya tidak ada pilihan di dropdown ini yang
// ditolak backend.
const SUBCATEGORIES = {
  aset: ["kas_bank", "aset_lancar", "aset_tetap", "aset_takberwujud", "aset_lain_lain"],
  kewajiban: ["kewajiban_jangka_pendek", "kewajiban_jangka_panjang",
              "utang_bagi_hasil_bumdes", "utang_bagi_hasil_unit"],
  ekuitas: ["modal_desa", "modal_masyarakat", "bagi_hasil_desa", "bagi_hasil_masyarakat",
            "ikhtisar_laba_rugi", "laba_dicadangkan", "saldo_laba"],
  pendapatan: ["pendapatan_operasional", "pendapatan_lain_lain"],
  hpp: ["hpp_barang_dagangan", "hpp_barang_jadi"],
  beban: ["beban_administrasi", "beban_operasional", "beban_lain_lain"],
} as const;

type AccCategory = keyof typeof SUBCATEGORIES;

const DEFAULT_NB: Record<AccCategory, "debit" | "kredit"> = {
  aset: "debit", kewajiban: "kredit", ekuitas: "kredit",
  pendapatan: "kredit", hpp: "debit", beban: "debit",
};

const emptyAcc: AccountFormValues = {
  code: "", name: "", category: "aset", subcategory: "aset_lancar",
  normal_balance: "debit",
};
type TTFormState = { code: string; name: string; debit: string; credit: string };
const emptyTT: TTFormState = { code: "", name: "", debit: "", credit: "" };

type CoaAccount = Account & { subcategory?: string | null };

export default function COAPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === "admin";
  const canAdd = isAdmin;

  const [list, setList] = useState<CoaAccount[]>([]);
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [units, setUnits] = useState<UnitUsaha[]>([]);
  const [group, setGroup] = useState("BUMDES");
  const [activeSection, setActiveSection] = useState<"accounts" | "transaction-types">("accounts");

  const [filter, setFilter] = useState(""); // category filter (aset/kewajiban/...)

  const [showAcc, setShowAcc] = useState(false);
  const [editAccCode, setEditAccCode] = useState<string | null>(null);
  const [accErr, setAccErr] = useState("");
  const accForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: emptyAcc,
  });
  const watchedCategory = accForm.watch("category");
  const watchedSubcategory = accForm.watch("subcategory");

  const [showTT, setShowTT] = useState(false);
  const [editTTCode, setEditTTCode] = useState<string | null>(null);
  const [ttForm, setTtForm] = useState<TTFormState>(emptyTT);
  const [ttErr, setTtErr] = useState("");
  const accountFileRef = useRef<HTMLInputElement | null>(null);
  const transactionFileRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = async (section: "accounts" | "transaction-types") => {
    try {
      const isTransactions = section === "transaction-types";
      const templatePath = isTransactions ? "transaction-types/template" : "accounts/template";
      const res = await fetch(`${API}/${templatePath}?group=${encodeURIComponent(group)}`, { credentials: "include" });
      if (!res.ok) { notify("Gagal mengunduh template"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = section === "transaction-types" ? "Template-Jenis-Transaksi.xlsx" : "Template-Kode-Akun.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (er: unknown) { notify(getApiError(er, "Gagal")); }
  };

  const importFile = async (e: ChangeEvent<HTMLInputElement>, section: "accounts" | "transaction-types") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isTransactions = section === "transaction-types";
    if (!(await confirm({ title: isTransactions ? "Import jenis transaksi" : "Import chart of accounts", description: `Import file "${file.name}"? Baris duplikat akan dilewati.`, confirmLabel: "Import" }))) {
      e.target.value = ""; return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(isTransactions ? "/transaction-types/import" : "/accounts/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { inserted, skipped, errors } = r.data;
      let msg = `Berhasil ditambahkan: ${inserted} akun\nDilewati: ${skipped}`;
      if (errors && errors.length) {
        msg += `\n\nCatatan (${errors.length}):\n` + errors.slice(0, 10).join("\n");
      }
      notify(msg);
      load();
    } catch (er) {
      notify(getApiError(er, "Gagal import"));
    } finally {
      e.target.value = "";
    }
  };

  const exportMasterData = async (section: string) => {
    try {
      const res = await fetch(`${API}/master-data/export?group=${encodeURIComponent(group)}&section=${section}`, { credentials: "include" });
      if (!res.ok) { notify("Gagal export master data"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Master-Data-${group}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (er: unknown) { notify(getApiError(er, "Gagal export")); }
  };

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t, u] = await Promise.all([
        api.get<CoaAccount[]>("/accounts"),
        api.get<TransactionType[]>("/transaction-types"),
        api.get<UnitUsaha[]>("/unit-usaha"),
      ]);
      setList(a.data ?? []); setTypes(t.data ?? []); setUnits(u.data ?? []);
    } catch (er) {
      notify(getApiError(er, "Gagal memuat kode akun/jenis transaksi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onCatChange = (cat: string) => {
    const key = cat as AccCategory;
    const subs = SUBCATEGORIES[key];
    accForm.setValue("category", cat);
    accForm.setValue("subcategory", subs?.[0] || "");
    accForm.setValue("normal_balance", DEFAULT_NB[key] || "debit");
  };

  const openCreateAcc = () => {
    setEditAccCode(null);
    accForm.reset(emptyAcc);
    setAccErr("");
    setShowAcc(true);
  };
  const openEditAcc = (a: CoaAccount) => {
    setEditAccCode(a.code);
    const cat = (a.category || "aset") as AccCategory;
    accForm.reset({
      code: a.code,
      name: a.name,
      category: a.category || "aset",
      subcategory: a.subcategory || (SUBCATEGORIES[cat]?.[0] || ""),
      normal_balance: (a.normal_balance === "kredit" ? "kredit" : "debit"),
    });
    setAccErr("");
    setShowAcc(true);
  };

  const submitAcc = async (values: AccountFormValues) => {
    setAccErr("");
    try {
      const body = {
        code: values.code.trim(), name: values.name.trim(),
        category: values.category, subcategory: values.subcategory,
        normal_balance: values.normal_balance,
        group,
      };
      if (editAccCode) {
        await api.put(`/accounts/${encodeURIComponent(editAccCode)}`, body, { params: { group } });
      } else {
        await api.post("/accounts", body);
      }
      setShowAcc(false); setEditAccCode(null); void load();
    } catch (ex: unknown) { setAccErr(getApiError(ex, "Gagal menyimpan")); }
  };

  const delAcc = async (code: string) => {
    if (!(await confirm({ title: "Hapus kode akun", description: `Hapus kode akun ${code} di kelompok ${group}?`, confirmLabel: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/accounts/${encodeURIComponent(code)}`, { params: { group } });
      void load();
    } catch (ex: unknown) { notify(getApiError(ex, "Gagal hapus")); }
  };

  const openCreateTT = () => { setEditTTCode(null); setTtForm(emptyTT); setTtErr(""); setShowTT(true); };
  const openEditTT = (t: TransactionType) => {
    setEditTTCode(t.code);
    setTtForm({ code: t.code, name: t.name, debit: t.debit || "", credit: t.credit || "" });
    setTtErr(""); setShowTT(true);
  };

  const submitTT = async (e: FormEvent) => {
    e.preventDefault(); setTtErr("");
    try {
      const body = {
        code: ttForm.code.trim(), name: ttForm.name.trim(),
        debit: ttForm.debit, credit: ttForm.credit,
        unit_codes: group === "BUMDES" ? [] : [group],
        group,  // auto-set from active tab
      };
      if (editTTCode) await api.put(`/transaction-types/${encodeURIComponent(editTTCode)}`, body);
      else await api.post("/transaction-types", body);
      setShowTT(false); setEditTTCode(null); void load();
    } catch (ex: unknown) { setTtErr(getApiError(ex, "Gagal menyimpan")); }
  };

  const delTT = async (code: string) => {
    if (!(await confirm({ title: "Hapus jenis transaksi", description: `Hapus jenis transaksi ${code}?`, confirmLabel: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/transaction-types/${encodeURIComponent(code)}`);
      void load();
    } catch (ex: unknown) { notify(getApiError(ex, "Gagal hapus")); }
  };

  // Filter by active group tab + category
  const groupAccounts = useMemo(
    () => list.filter(a => (a.group || "BUMDES") === group),
    [list, group]
  );
  const filteredAccounts = useMemo(
    () => (filter ? groupAccounts.filter(a => a.category === filter) : groupAccounts),
    [groupAccounts, filter]
  );
  const groupTypes = useMemo(
    () => types.filter(t => (t.group || "BUMDES") === group),
    [types, group]
  );

  const accSort = useSort(filteredAccounts as unknown as Record<string, unknown>[], "code", "asc");
  const ttSort = useSort(groupTypes as unknown as Record<string, unknown>[], "code", "asc");
  const sortedAccounts = accSort.sorted as unknown as CoaAccount[];
  const sortedTypes = ttSort.sorted as unknown as TransactionType[];

  // Bulk selection state
  const [selAcc, setSelAcc] = useState<Set<string>>(new Set());
  const [selTT, setSelTT] = useState<Set<string>>(new Set());
  useEffect(() => { setSelAcc(new Set()); setSelTT(new Set()); }, [group]);

  const bulkDelAcc = async () => {
    if (selAcc.size === 0) return;
    if (!(await confirm({ title: "Hapus kode akun terpilih", description: `Hapus ${selAcc.size} kode akun terpilih di grup ${group}?`, confirmLabel: "Hapus semua", destructive: true }))) return;
    for (const code of selAcc) {
      try { await api.delete(`/accounts/${encodeURIComponent(code)}`, { params: { group } }); } catch (_e) { /* ignore */ }
    }
    setSelAcc(new Set()); load();
  };
  const bulkDelTT = async () => {
    if (selTT.size === 0) return;
    if (!(await confirm({ title: "Hapus tipe transaksi terpilih", description: `Hapus ${selTT.size} jenis transaksi terpilih di grup ${group}?`, confirmLabel: "Hapus semua", destructive: true }))) return;
    for (const code of selTT) {
      try { await api.delete(`/transaction-types/${encodeURIComponent(code)}`); } catch (_e) { /* ignore */ }
    }
    setSelTT(new Set()); load();
  };

  const groupTabs = useMemo(() => {
    const tabs = [{ key: "BUMDES", label: "BUMDes", sub: "Pusat" }];
    units.forEach(u => tabs.push({ key: u.code, label: u.code, sub: u.name }));
    return tabs;
  }, [units]);

  const groupLabel = groupTabs.find(g => g.key === group)?.sub || group;

  return (
    <div className="space-y-6" data-testid="coa-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Chart of Accounts</p>
          <h1 className="font-heading text-3xl font-bold page-h1">Kode Akun & Jenis Transaksi</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Setiap kelompok (BUMDes & 6 Unit) memiliki kode akun serta jenis transaksi <b>terpisah</b> — tidak saling terhubung.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-3" data-testid="master-data-controls">
          <Card className="p-4">
            <label className="label mb-2" htmlFor="master-group-select">Kelompok</label>
            <Select value={group} onValueChange={(v) => { setGroup(v); setFilter(""); }}>
              <SelectTrigger id="master-group-select" data-testid="master-group-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {groupTabs.map(g => <SelectItem key={g.key} value={g.key}>{g.key === "BUMDES" ? "BUMDes - Pusat" : `${g.label} - ${g.sub}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>
          <Card className="p-4 flex flex-wrap gap-2" data-testid="master-type-tabs">
            <Button data-testid="tab-accounts" onClick={() => setActiveSection("accounts")} variant={activeSection === "accounts" ? "default" : "outline"}>Kode Akun</Button>
            <Button data-testid="tab-transaction-types" onClick={() => setActiveSection("transaction-types")} variant={activeSection === "transaction-types" ? "default" : "outline"}>Jenis Transaksi</Button>
          </Card>
        </div>
      )}

      {loading && (
        <Card className="py-10 flex justify-center">
          <Spinner label="Memuat kode akun & jenis transaksi..." />
        </Card>
      )}

      {!loading && activeSection === "accounts" && <>
      {/* ============ KODE AKUN ============ */}
      <Card className="p-4 flex flex-wrap items-center gap-2" data-testid="account-toolbar">
        <Button variant="outline" data-testid="btn-download-account-template" onClick={() => downloadTemplate("accounts")}><Download  className="size-4" /> Download Template</Button>
        <Button variant="outline" data-testid="btn-import-account" onClick={() => accountFileRef.current?.click()}><Upload  className="size-4" /> Import Excel</Button>
        <Button variant="outline" data-testid="btn-export-account" onClick={() => exportMasterData("accounts")}><Download  className="size-4" /> Export Excel</Button>
        <input ref={accountFileRef} type="file" accept=".xlsx" onChange={(e) => importFile(e, "accounts")} hidden />
      </Card>
      <div className="flex justify-between items-center gap-4 flex-wrap pt-2">
        <div>
          <h2 className="font-heading text-2xl font-bold">Kode Akun — {groupLabel}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {sortedAccounts.length} akun aktif pada kelompok <b>{group}</b>.
          </p>
        </div>
        {canAdd && (
          <Button data-testid="btn-new-account" onClick={openCreateAcc}>
            <Plus  className="size-4" /> Tambah Kode Akun
          </Button>
        )}
      </div>

      {showAcc && canAdd && (
        <Card className="fade-in">
        <CardContent className="pt-6">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editAccCode
              ? `Edit Kode Akun (${editAccCode}) — ${groupLabel}`
              : `Kode Akun Baru — ${groupLabel}`}
          </h3>
          <form onSubmit={(e) => void accForm.handleSubmit(submitAcc)(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Kode Akun</label>
              <Input data-testid="acc-code" {...accForm.register("code")} />
              {accForm.formState.errors.code && (
                <p className="mt-1 text-xs text-destructive">{accForm.formState.errors.code.message}</p>
              )}
            </div>
            <div>
              <label className="label">Nama Akun</label>
              <Input data-testid="acc-name" {...accForm.register("name")} />
              {accForm.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">{accForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Kategori</label>
              <Select
                value={Object.keys(CAT_LABELS).includes(watchedCategory) ? watchedCategory : "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    accForm.setValue("category", "");
                    accForm.setValue("subcategory", "");
                  } else {
                    onCatChange(v);
                  }
                }}
              >
                <SelectTrigger data-testid="acc-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  <SelectItem value="__custom__">+ Kategori Baru (custom)</SelectItem>
                </SelectContent>
              </Select>
              {!Object.keys(CAT_LABELS).includes(watchedCategory) && (
                <Input
                  data-testid="acc-category-custom"
                  className="mt-2"
                  placeholder="Ketik nama kategori baru..."
                  value={watchedCategory}
                  onChange={(e) => accForm.setValue("category", e.target.value.toLowerCase())}
                />
              )}
            </div>
            <div>
              <label className="label">Sub-Kategori</label>
              <Select
                value={
                  ((SUBCATEGORIES[watchedCategory as AccCategory] || []) as readonly string[]).includes(watchedSubcategory)
                    ? watchedSubcategory
                    : watchedSubcategory ? "__custom__" : "__none__"
                }
                onValueChange={(v) => {
                  if (v === "__custom__" || v === "__none__") accForm.setValue("subcategory", "");
                  else accForm.setValue("subcategory", v);
                }}
              >
                <SelectTrigger data-testid="acc-subcategory"><SelectValue placeholder="— pilih —" /></SelectTrigger>
                <SelectContent>
                  {((SUBCATEGORIES[watchedCategory as AccCategory] || []) as readonly string[]).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Sub-Kategori Baru (custom)</SelectItem>
                </SelectContent>
              </Select>
              {(!(SUBCATEGORIES[watchedCategory as AccCategory]) ||
                !(SUBCATEGORIES[watchedCategory as AccCategory] as readonly string[]).includes(watchedSubcategory)) && (
                <Input
                  data-testid="acc-subcategory-custom"
                  className="mt-2"
                  placeholder="Ketik nama sub-kategori baru..."
                  value={watchedSubcategory}
                  onChange={(e) =>
                    accForm.setValue(
                      "subcategory",
                      e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    )
                  }
                />
              )}
            </div>
            <div>
              <label className="label">Saldo Normal</label>
              <Controller
                control={accForm.control}
                name="normal_balance"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="acc-normal-balance"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="kredit">Kredit</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <p className="sm:col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Akun ini akan disimpan pada kelompok <b>{group}</b>.
            </p>
            {accErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                            style={{ background: "var(--status-error-bg)", color: "var(--status-error)", border: "1px solid var(--status-error-border)" }}>{accErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAcc(false)}>Batal</Button>
              <Button data-testid="acc-save">Simpan</Button>
            </div>
          </form>
        </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["", "Semua"], ...Object.entries(CAT_LABELS)].map(([k, v]) => (
          <Button key={k} data-testid={`cat-filter-${k || "all"}`}
                  onClick={() => setFilter(k)} size="sm"
                  variant={filter === k ? "secondary" : "outline"}>{v}</Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <TableShell minWidth={720}>
        {isAdmin && selAcc.size > 0 && (
          <div className="p-3 flex justify-between items-center" style={{ background: "var(--status-error-bg)", borderBottom: "1px solid var(--status-error-border)" }}>
            <span className="text-sm" style={{ color: "var(--status-error)" }}>{selAcc.size} akun terpilih</span>
            <Button data-testid="bulk-del-acc" onClick={bulkDelAcc} size="sm"
                    className="text-xs" variant="destructive">
              <Trash2  className="size-4" /> Hapus Terpilih
            </Button>
          </div>
        )}
        <Table data-testid="coa-table">
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead style={{ width: 32 }}>
                  <Checkbox data-testid="coa-select-all"
                         checked={sortedAccounts.length > 0 && sortedAccounts.every(a => selAcc.has(a.code))}
                         onCheckedChange={(checked) => setSelAcc(checked ? new Set(sortedAccounts.map(a => a.code)) : new Set())} />
                </TableHead>
              )}
              <TableHead {...accSort.headerProps("code")}>Kode{accSort.sortIndicator("code")}</TableHead>
              <TableHead {...accSort.headerProps("name")}>Nama Akun{accSort.sortIndicator("name")}</TableHead>
              <TableHead {...accSort.headerProps("category")}>Kategori{accSort.sortIndicator("category")}</TableHead>
              <TableHead {...accSort.headerProps("subcategory")}>Sub{accSort.sortIndicator("subcategory")}</TableHead>
              <TableHead {...accSort.headerProps("normal_balance")}>Saldo Normal{accSort.sortIndicator("normal_balance")}</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAccounts.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8"
                      style={{ color: "var(--text-muted)" }}>
                Belum ada kode akun pada kelompok <b>{group}</b>.
              </TableCell></TableRow>
            ) : sortedAccounts.map(a => (
              <TableRow key={a.code}>
                {isAdmin && (
                  <TableCell>
                    <Checkbox data-testid={`sel-acc-${a.code}`}
                           checked={selAcc.has(a.code)}
                           onCheckedChange={() => setSelAcc(prev => {
                             const n = new Set(prev);
                             n.has(a.code) ? n.delete(a.code) : n.add(a.code);
                             return n;
                           })} />
                  </TableCell>
                )}
                <TableCell className="font-mono font-semibold">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell>{(a.category && CAT_LABELS[a.category]) ? <Badge>{CAT_LABELS[a.category]}</Badge> : <Badge variant="secondary">{a.category}</Badge>}</TableCell>
                <TableCell className="text-xs">{a.subcategory}</TableCell>
                <TableCell>{a.normal_balance === "debit"
                  ? <Badge variant="outline">Debit</Badge>
                  : <Badge variant="secondary">Kredit</Badge>}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <button data-testid={`edit-acc-${a.code}`} onClick={() => openEditAcc(a)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil  className="size-4" />
                      </button>
                      <button data-testid={`del-acc-${a.code}`} onClick={() => delAcc(a.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash2  className="size-4" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableShell>
      </Card>

      </>}

      {!loading && activeSection === "transaction-types" && <>
      {/* ============ JENIS TRANSAKSI ============ */}
      <Card className="p-4 flex flex-wrap items-center gap-2" data-testid="transaction-toolbar">
        <Button variant="outline" data-testid="btn-download-transaction-template" onClick={() => downloadTemplate("transaction-types")}><Download  className="size-4" /> Download Template</Button>
        <Button variant="outline" data-testid="btn-import-transaction" onClick={() => transactionFileRef.current?.click()}><Upload  className="size-4" /> Import Excel</Button>
        <Button variant="outline" data-testid="btn-export-transaction" onClick={() => exportMasterData("transaction-types")}><Download  className="size-4" /> Export Excel</Button>
        <input ref={transactionFileRef} type="file" accept=".xlsx" onChange={(e) => importFile(e, "transaction-types")} hidden />
      </Card>
      <div className="flex justify-between items-center gap-4 flex-wrap pt-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Jenis Transaksi — {groupLabel}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {sortedTypes.length} jenis transaksi pada kelompok <b>{group}</b>. Debit & Kredit hanya bisa memilih akun dari kelompok yang sama.
          </p>
        </div>
        {isAdmin && (
          <Button data-testid="btn-new-tt" onClick={openCreateTT}>
            <Plus  className="size-4" /> Tambah Jenis Transaksi
          </Button>
        )}
      </div>

      {showTT && isAdmin && (
        <Card className="fade-in">
        <CardContent className="pt-6">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editTTCode
              ? `Edit Jenis Transaksi (${editTTCode}) — ${groupLabel}`
              : `Jenis Transaksi Baru — ${groupLabel}`}
          </h3>
          <form onSubmit={submitTT} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Kode</label>
              <Input data-testid="tt-code" required
                     placeholder="mis. penjualan_kios"
                     value={ttForm.code} onChange={(e) => setTtForm({ ...ttForm, code: e.target.value })} /></div>
            <div><label className="label">Nama Transaksi</label>
              <Input data-testid="tt-name" required
                     value={ttForm.name} onChange={(e) => setTtForm({ ...ttForm, name: e.target.value })} /></div>
            <div><label className="label">Akun Debit (default)</label>
              <Select required value={ttForm.debit || "__none__"} onValueChange={(v) => setTtForm({ ...ttForm, debit: v === "__none__" ? "" : v })}>
                <SelectTrigger data-testid="tt-debit"><SelectValue placeholder={`— pilih akun ${group} —`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— pilih akun {group} —</SelectItem>
                  {groupAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div><label className="label">Akun Kredit (default)</label>
              <Select required value={ttForm.credit || "__none__"} onValueChange={(v) => setTtForm({ ...ttForm, credit: v === "__none__" ? "" : v })}>
                <SelectTrigger data-testid="tt-credit"><SelectValue placeholder={`— pilih akun ${group} —`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— pilih akun {group} —</SelectItem>
                  {groupAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <p className="sm:col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Jenis transaksi ini akan disimpan pada kelompok <b>{group}</b>.
            </p>
            {ttErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                           style={{ background: "var(--status-error-bg)", color: "var(--status-error)" }}>{ttErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowTT(false)}>Batal</Button>
              <Button data-testid="tt-save">Simpan</Button>
            </div>
          </form>
        </CardContent>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <TableShell minWidth={720}>
        {isAdmin && selTT.size > 0 && (
          <div className="p-3 flex justify-between items-center" style={{ background: "var(--status-error-bg)", borderBottom: "1px solid var(--status-error-border)" }}>
            <span className="text-sm" style={{ color: "var(--status-error)" }}>{selTT.size} jenis transaksi terpilih</span>
            <Button data-testid="bulk-del-tt" onClick={bulkDelTT} size="sm"
                    className="text-xs" variant="destructive">
              <Trash2  className="size-4" /> Hapus Terpilih
            </Button>
          </div>
        )}
        <Table data-testid="tt-table">
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead style={{ width: 32 }}>
                  <Checkbox data-testid="tt-select-all"
                         checked={sortedTypes.length > 0 && sortedTypes.every(t => selTT.has(t.code))}
                         onCheckedChange={(checked) => setSelTT(checked ? new Set(sortedTypes.map(t => t.code)) : new Set())} />
                </TableHead>
              )}
              <TableHead {...ttSort.headerProps("name")}>Nama Transaksi{ttSort.sortIndicator("name")}</TableHead>
              <TableHead {...ttSort.headerProps("debit")}>Debit / Kredit{ttSort.sortIndicator("debit")}</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTypes.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 4 : 2} className="text-center py-6" style={{ color: "var(--text-muted)" }}>
                Belum ada jenis transaksi pada kelompok <b>{group}</b>.
              </TableCell></TableRow>
            ) : sortedTypes.map(t => (
              <TableRow key={t.code}>
                {isAdmin && (
                  <TableCell>
                    <Checkbox data-testid={`sel-tt-${t.code}`}
                           checked={selTT.has(t.code)}
                           onCheckedChange={() => setSelTT(prev => {
                             const n = new Set(prev);
                             n.has(t.code) ? n.delete(t.code) : n.add(t.code);
                             return n;
                           })} />
                  </TableCell>
                )}
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{t.code}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div>D: {t.debit}</div>
                  <div>K: {t.credit}</div>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <button data-testid={`edit-tt-${t.code}`} onClick={() => openEditTT(t)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil  className="size-4" />
                      </button>
                      <button data-testid={`del-tt-${t.code}`} onClick={() => delTT(t.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash2  className="size-4" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableShell>
      </Card>
      </>}
    </div>
  );
}
