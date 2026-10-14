import FormDialog from '@/components/FormDialog'
import HelpHint from "@/components/HelpHint";
import { ArrowDown, FileText, Tags, ArrowUp, HandCoins, Package, Pencil, PieChart, SlidersHorizontal, Truck, Users, Wallet } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import api, { fmtRp, fmtDate } from "@/api/client";
import { useAuth, can } from "@/lib/auth";
import type {
  InventoryAdjustment,
  InventoryCategory,
  InventoryMeta,
  InventoryMovement,
  InventoryMovementReport,
  InventoryPartner,
  InventoryProduct,
  InventoryPurchase,
  InventorySale,
  InventoryValuation,
  PeriodValue,
} from "@/types";
import {
  KAS_ACCOUNT_CODE, PIUTANG_ACCOUNT_CODE, UTANG_ACCOUNT_CODE,
} from "@/lib/uu05InventoryCoa";
import SubTabs from "@/components/SubTabs";
import CommercialDocuments from "@/pages/inventory/CommercialDocuments";
import InventorySummary from "@/pages/InventorySummary";
import CatalogTable from "@/pages/inventory/CatalogTable";
import CategoryTable from "@/pages/inventory/CategoryTable";
import StockInFormCard from "@/pages/inventory/StockInFormCard";
import StockOutFormCard from "@/pages/inventory/StockOutFormCard";
import AdjustFormCard from "@/pages/inventory/AdjustFormCard";
import StockLedgerTable from "@/pages/inventory/StockLedgerTable";
import PartnerFormCard from "@/pages/inventory/PartnerFormCard";
import {
  emptyPartnerFormValues,
  type AdjustFormValues,
  type PartnerFormValues,
  type StockInFormValues,
  type StockOutFormValues,
} from "@/schemas/inventory";
import TableShell from "@/components/TableShell";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatApiError(err: unknown, fallback = "Terjadi kesalahan"): string {
  const detail = (err as { response?: { data?: { detail?: unknown }; message?: string }; message?: string })
    ?.response?.data?.detail;
  if (detail == null) {
    return (err as { message?: string })?.message || fallback;
  }
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item: unknown) => {
      if (typeof item === "string") return item;
      const obj = item as { loc?: unknown[]; msg?: string; message?: string };
      const loc = Array.isArray(obj?.loc)
        ? obj.loc.filter((x) => x !== "body").join(".")
        : "";
      const msg = obj?.msg || obj?.message || JSON.stringify(item);
      return loc ? `${loc}: ${msg}` : msg;
    }).join("; ");
  }
  if (typeof detail === "object" && detail !== null) {
    const msg = (detail as { message?: string }).message;
    return msg || JSON.stringify(detail);
  }
  return String(detail);
}

const BASE = "/v1/uu05_inventory";
const today = () => new Date().toISOString().slice(0, 10);

// Tab utama -> sub tab (id sub tab = id tab lama, sehingga state & loader tetap sama).
const TAB_GROUPS = [
  { id: "ringkasan", label: "Ringkasan", icon: PieChart, tabs: [{ id: "summary", label: "Ringkasan", icon: PieChart }] },
  { id: "persetokan", label: "Persetokan", icon: Package, tabs: [
    { id: "kategori", label: "Kategori Produk", icon: Tags },
    { id: "katalog", label: "Katalog Produk", icon: Package },
    { id: "stock-in", label: "Stock In", icon: ArrowDown },
    { id: "stock-out", label: "Stock Out", icon: ArrowUp },
    { id: "kelola", label: "Penyesuaian Stok", icon: SlidersHorizontal },
  ] },
  { id: "data-orang", label: "Data Orang-Orang", icon: Users, tabs: [
    { id: "vendor", label: "Pemasok", icon: Truck },
    { id: "customer", label: "Customer", icon: Users },
  ] },
  { id: "perutangan", label: "Perutangan", icon: Wallet, tabs: [
    { id: "utang", label: "Utang", icon: Wallet },
    { id: "piutang", label: "Piutang", icon: HandCoins },
  ] },
  { id: "documents", label: "Dokumen", icon: FileText, tabs: [{ id: "documents", label: "Dokumen", icon: FileText }] },
];

export default function Inventory() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTabRaw] = useState(searchParams.has("document") ? "documents" : "summary");
  // Tab lama "laporan" sudah digabung ke Ringkasan.
  const setTab = (id: string) => setTabRaw(id === "laporan" ? "summary" : id);
  const activeGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === tab)) ?? TAB_GROUPS[0];
  const [meta, setMeta] = useState<InventoryMeta | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [vendors, setVendors] = useState<InventoryPartner[]>([]);
  const [customers, setCustomers] = useState<InventoryPartner[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [sales, setSales] = useState<InventorySale[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [movementReport, setMovementReport] = useState<InventoryMovementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<{ kind: "purchase" | "sale"; id: string; outstanding: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [operation, setOperation] = useState<"stock-in" | "stock-out" | "adjust" | "vendor" | "customer" | null>(null);
  const [vendorEditingId, setVendorEditingId] = useState<string | null>(null);
  const [vendorDefaults, setVendorDefaults] = useState<PartnerFormValues>(emptyPartnerFormValues());
  const [customerEditingId, setCustomerEditingId] = useState<string | null>(null);
  const [customerDefaults, setCustomerDefaults] = useState<PartnerFormValues>(emptyPartnerFormValues());
  const [period] = useState<PeriodValue>({
    mode: "monthly", startDate: "", endDate: "", label: "",
  });

  const canAccessRole = can(user, "admin", "direktur", "bendahara", "pengelola");
  const canWrite = can(user, "admin", "direktur", "bendahara", "pengelola");
  const isAdmin = can(user, "admin");

  const loadCore = useCallback(async () => {
    setError("");
    try {
      const [m, p, c] = await Promise.all([
        api.get(`${BASE}/meta`),
        api.get(`${BASE}/products`),
        api.get(`${BASE}/categories`),
      ]);
      setMeta(m.data);
      setProducts(Array.isArray(p.data) ? p.data : []);
      setCategories(Array.isArray(c.data) ? c.data : []);
    } catch (e) {
      setError(formatApiError(e, "Gagal memuat inventory"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOps = useCallback(async () => {
    try {
      const [mov, adj] = await Promise.all([
        api.get(`${BASE}/movements`, { params: { limit: 50 } }),
        api.get(`${BASE}/adjustments`, { params: { limit: 50 } }),
      ]);
      setMovements(Array.isArray(mov.data) ? mov.data : []);
      setAdjustments(Array.isArray(adj.data) ? adj.data : []);
    } catch (e) {
      setError(formatApiError(e, "Gagal memuat mutasi"));
    }
  }, []);

  const loadTrade = useCallback(async () => {
    try {
      const [v, c, pu, sa] = await Promise.all([
        api.get(`${BASE}/vendors`),
        api.get(`${BASE}/customers`),
        api.get(`${BASE}/purchases`, { params: { limit: 100 } }),
        api.get(`${BASE}/sales`, { params: { limit: 100 } }),
      ]);
      setVendors(Array.isArray(v.data) ? v.data : []);
      setCustomers(Array.isArray(c.data) ? c.data : []);
      setPurchases(Array.isArray(pu.data) ? pu.data : []);
      setSales(Array.isArray(sa.data) ? sa.data : []);
    } catch (e) {
      setError(formatApiError(e, "Gagal memuat mitra pemasok/customer"));
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [val, mov] = await Promise.all([
        api.get(`${BASE}/reports/valuation`),
        api.get(`${BASE}/reports/movements`, {
          params: {
            date_from: period.startDate || undefined,
            date_to: period.endDate || undefined,
          },
        }),
      ]);
      setValuation(val.data);
      setMovementReport(mov.data);
    } catch (e) {
      setError(formatApiError(e, "Gagal memuat laporan"));
    }
  }, [period]);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => {
    if (tab === "kelola" || tab === "stock-in" || tab === "stock-out" || tab === "summary") loadOps();
    if (tab === "summary") loadReports();
    if (["stock-in", "stock-out", "vendor", "customer", "utang", "piutang"].includes(tab)) loadTrade();
  }, [tab, loadOps, loadReports, loadTrade]);

  const activeVendors = useMemo(() => vendors.filter((v) => v.is_active), [vendors]);
  const activeCustomers = useMemo(() => customers.filter((c) => c.is_active), [customers]);

  if (!canAccessRole) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner column size={48} label="Memuat inventory…" /></div>;
  }
  if (meta && user?.role === "pengelola" && user.unit_usaha_id !== meta.unit_usaha_id) {
    return <Navigate to="/dashboard" replace />;
  }

  const submitStockIn = async (values: StockInFormValues) => {
    try {
      await api.post(`${BASE}/stock-in`, {
        ...values,
        quantity: Number(values.quantity),
        unit_cost: Number(values.unit_cost),
        due_date: values.payment_method === "credit" ? values.due_date : null,
        vendor_id: values.vendor_id || null,
        unit_usaha_id: meta?.unit_usaha_id,
      });
      await Promise.all([loadCore(), loadOps(), loadTrade()]);
    } catch (err) {
      setError(formatApiError(err));
      throw err;
    }
  };

  const submitStockOut = async (values: StockOutFormValues) => {
    try {
      if (values.isInternal) {
        await api.post(`${BASE}/stock-out-internal`, {
          product_id: values.product_id,
          quantity: Number(values.quantity),
          movement_date: values.movement_date,
          debit_account_code: values.debit_account_code,
          credit_account_code: values.credit_account_code,
          note: values.note,
          unit_usaha_id: meta?.unit_usaha_id,
        });
      } else {
        await api.post(`${BASE}/stock-out`, {
          ...values,
          quantity: Number(values.quantity),
          sell_price: Number(values.sell_price),
          due_date: values.payment_method === "piutang" ? values.due_date : null,
          unit_usaha_id: meta?.unit_usaha_id,
        });
      }
      await Promise.all([loadCore(), loadOps(), loadTrade()]);
    } catch (err) {
      setError(formatApiError(err));
      throw err;
    }
  };

  const submitAdjust = async (values: AdjustFormValues) => {
    try {
      await api.post(`${BASE}/adjustments`, {
        ...values,
        quantity_delta: Number(values.quantity_delta),
        unit_usaha_id: meta?.unit_usaha_id,
      });
      await Promise.all([loadCore(), loadOps()]);
    } catch (err) {
      setError(formatApiError(err));
      throw err;
    }
  };

  const cancelMovement = async (id: string) => {
    if (!window.confirm("Batalkan mutasi ini? Mutasi, transaksi pembelian/penjualan & jurnal terkait akan dihapus permanen.")) return;
    try {
      await api.post(`${BASE}/cancel-movement`, { stock_card_id: id });
      await Promise.all([loadCore(), loadOps(), loadTrade()]);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const cancelAdjustment = async (id: string) => {
    if (!window.confirm("Batalkan penyesuaian ini? Qty dikembalikan dan jurnal terkait dihapus.")) return;
    try {
      await api.post(`${BASE}/cancel-adjustment`, { adjustment_id: id });
      await Promise.all([loadCore(), loadOps()]);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const closeVendorForm = () => {
    setOperation(null);
    setVendorEditingId(null);
    setVendorDefaults(emptyPartnerFormValues());
  };

  const submitVendor = async (values: PartnerFormValues) => {
    try {
      if (vendorEditingId) {
        await api.put(`${BASE}/vendors/${vendorEditingId}`, {
          name: values.name, contact: values.contact, address: values.address,
        });
      } else {
        await api.post(`${BASE}/vendors`, {
          name: values.name, contact: values.contact, address: values.address,
          unit_usaha_id: meta?.unit_usaha_id,
        });
      }
      closeVendorForm();
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err, "Gagal menyimpan mitra pemasok"));
    }
  };

  const toggleVendorActive = async (v: InventoryPartner) => {
    try {
      await api.put(`${BASE}/vendors/${v.id}`, { is_active: !v.is_active });
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const closeCustomerForm = () => {
    setOperation(null);
    setCustomerEditingId(null);
    setCustomerDefaults(emptyPartnerFormValues());
  };

  const submitCustomer = async (values: PartnerFormValues) => {
    try {
      if (customerEditingId) {
        await api.put(`${BASE}/customers/${customerEditingId}`, {
          name: values.name, contact: values.contact, address: values.address,
        });
      } else {
        await api.post(`${BASE}/customers`, {
          name: values.name, contact: values.contact, address: values.address,
          unit_usaha_id: meta?.unit_usaha_id,
        });
      }
      closeCustomerForm();
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err, "Gagal menyimpan customer"));
    }
  };

  const toggleCustomerActive = async (c: InventoryPartner) => {
    try {
      await api.put(`${BASE}/customers/${c.id}`, { is_active: !c.is_active });
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const payPurchase = (purchase: InventoryPurchase) => {
    setError(""); setPayment({ kind: "purchase", id: purchase.id, outstanding: Number(purchase.outstanding) });
    setPaymentAmount(String(purchase.outstanding)); setPaymentDate(today());
  };
  const paySale = (sale: InventorySale) => {
    setError(""); setPayment({ kind: "sale", id: sale.id, outstanding: Number(sale.outstanding) });
    setPaymentAmount(String(sale.outstanding)); setPaymentDate(today());
  };
  const submitPayment = async () => {
    if (!payment) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > payment.outstanding) {
      setError("Nominal harus lebih dari Rp 0 dan tidak melebihi sisa tagihan."); return;
    }
    await api.post(`${BASE}/${payment.kind === "purchase" ? "purchases" : "sales"}/pay`, {
      [payment.kind === "purchase" ? "purchase_id" : "sale_id"]: payment.id,
      amount, paid_date: paymentDate,
      debit_account_code: payment.kind === "purchase" ? UTANG_ACCOUNT_CODE : KAS_ACCOUNT_CODE,
      credit_account_code: payment.kind === "purchase" ? KAS_ACCOUNT_CODE : PIUTANG_ACCOUNT_CODE,
      unit_usaha_id: meta?.unit_usaha_id,
    });
    setPayment(null); await loadTrade();
  };

  return (
    <div className="space-y-6 fade-in" data-testid="inventory-page">
      {payment && <FormDialog compact title={payment.kind === "purchase" ? "Pembayaran Utang" : "Penerimaan Piutang"} error={error} onClose={() => setPayment(null)}>{({ cancel, run }) => <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(submitPayment).catch(() => {}); }}>
        <p>Sisa tagihan: {fmtRp(payment.outstanding)}</p>
        <div><label className="label" htmlFor="payment-amount">Nominal (Rp)</label><Input id="payment-amount" type="number" inputMode="decimal" min="0.01" max={payment.outstanding} step="0.01" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
        <div><label className="label" htmlFor="payment-date">Tanggal Pembayaran</label><Input id="payment-date" type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={cancel}>Batal</Button><Button type="submit">Simpan</Button></div>
      </form>}</FormDialog>}

      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">{meta?.unit_code ? `Unit Usaha ${meta.unit_code}` : "Unit Usaha"}</p>
          <h1 className="font-heading page-h1 text-3xl font-bold">Manajemen Stok</h1>
        </div>
      </div>

      {error && (
        <Card className="p-3 text-sm" style={{ borderColor: "var(--status-error)", color: "var(--status-error-strong)", background: "var(--status-error-bg)" }} role="alert" data-testid="inventory-error">
          <strong className="block mb-1">Validasi / API</strong>
          <span>{typeof error === "string" ? error : JSON.stringify(error)}</span>
          <button type="button" className="ml-3 underline" onClick={() => setError("")}>tutup</button>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Tab inventory">
        {TAB_GROUPS.map((g) => {
          const Icon = g.icon;
          const active = activeGroup.id === g.id;
          return (
            <Button key={g.id} type="button" role="tab" aria-selected={active} variant={active ? "default" : "outline"} size="sm"
              onClick={() => { if (!active) setTab(g.tabs[0].id); }} data-testid={`tab-group-${g.id}`}>
              <Icon size={16} /> {g.label}
            </Button>
          );
        })}
      </div>

      {activeGroup.tabs.length > 1 && (
        <SubTabs tabs={activeGroup.tabs} value={tab} onChange={setTab} label={`Sub tab ${activeGroup.label}`} testId="inventory-subtabs" />
      )}

      {tab === "documents" && <CommercialDocuments />}

      {tab === "summary" && (
        <InventorySummary
          products={products}
          movements={movements}
          valuation={valuation}
          movementReport={movementReport}
        />
      )}

      {tab === "kategori" && (
        <CategoryTable categories={categories} isAdmin={isAdmin} onChanged={loadCore} onError={setError} />
      )}

      {tab === "katalog" && (
        <CatalogTable products={products} categories={categories} canWrite={canWrite} unitId={meta?.unit_usaha_id ?? undefined} onChanged={loadCore} onError={setError} />
      )}

      {tab === "stock-in" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-3 flex items-center gap-1">Penerimaan barang (Stock In / Pembelian)<HelpHint>Stock in menghasilkan transaksi stok masuk sekaligus transaksi Pembelian (tunai atau kredit/utang).</HelpHint></p>
            {canWrite ? <Button onClick={() => { setError(""); setOperation("stock-in"); } }>Input Penerimaan Barang</Button> : <p className="text-sm">Role Anda read-only.</p>}
            {canWrite && operation === "stock-in" && <FormDialog title="Penerimaan Barang" error={error} onClose={() => setOperation(null)}>{({ cancel, run }) => <>
              <StockInFormCard products={products} vendors={activeVendors} onOpenCatalog={() => { setOperation(null); setTab("katalog"); }} onSubmit={v => run(async () => { await submitStockIn(v); setOperation(null); })} />
              <Button className="mt-4" type="button" variant="outline" onClick={cancel}>Batal</Button>
            </>}</FormDialog>}
          </CardContent>
          </Card>
          <StockLedgerTable kind="in" refreshKey={movements} onCancel={canWrite ? cancelMovement : undefined} />
        </div>
      )}

      {tab === "stock-out" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-3 flex items-center gap-1">Pengeluaran barang (Stock Out / Penjualan)<HelpHint>Centang pemakaian internal untuk beban tanpa jurnal penjualan; tanpa centang = stock out penjualan (HPP + pendapatan, tunai/piutang).</HelpHint></p>
            {canWrite ? <Button onClick={() => { setError(""); setOperation("stock-out"); } }>Input Pengeluaran Barang</Button> : <p className="text-sm">Role Anda read-only.</p>}
            {canWrite && operation === "stock-out" && <FormDialog title="Pengeluaran Barang" error={error} onClose={() => setOperation(null)}>{({ cancel, run }) => <>
              <StockOutFormCard products={products} customers={activeCustomers} onClientError={setError} onSubmit={v => run(async () => { await submitStockOut(v); setOperation(null); })} />
              <Button className="mt-4" type="button" variant="outline" onClick={cancel}>Batal</Button>
            </>}</FormDialog>}
          </CardContent>
          </Card>
          <StockLedgerTable kind="out" refreshKey={movements} onCancel={canWrite ? cancelMovement : undefined} />
        </div>
      )}

      {tab === "kelola" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-3 flex items-center gap-1">Penyesuaian Stok<HelpHint><p>Pengurangan stok (delta negatif) menghasilkan 2 transaksi: pengurangan fisik nilai persediaan, lalu pengakuan beban kerugian.</p><p>Penambahan stok (delta positif) tetap 1 jurnal dengan akun kredit/offset pilihan Anda.</p></HelpHint></p>
            {canWrite ? <Button onClick={() => { setError(""); setOperation("adjust"); } }>Input Penyesuaian Stok</Button> : <p className="text-sm">Role Anda read-only.</p>}
            {canWrite && operation === "adjust" && <FormDialog title="Penyesuaian Stok" error={error} onClose={() => setOperation(null)}>{({ cancel, run }) => <>
              <AdjustFormCard products={products} onSubmit={v => run(async () => { await submitAdjust(v); setOperation(null); })} />
              <Button className="mt-4" type="button" variant="outline" onClick={cancel}>Batal</Button>
            </>}</FormDialog>}
          </CardContent>
          </Card>

          <StockLedgerTable kind="adjust" refreshKey={adjustments} onCancel={canWrite ? cancelAdjustment : undefined} />
        </div>
      )}

      {tab === "vendor" && (
        <div className="space-y-4">
          {canWrite && <Button onClick={() => { setError(""); setOperation("vendor"); } }>Tambah Pemasok</Button>}
          {canWrite && operation === "vendor" && (
            <FormDialog title={vendorEditingId ? 'Ubah Pemasok' : 'Tambah Pemasok'} onClose={closeVendorForm} error={error}>{({ cancel, run }) => <>
              <PartnerFormCard
                kind="vendor"
                editingId={vendorEditingId}
                defaultValues={vendorDefaults}
                onSubmit={v => run(() => submitVendor(v))}
                onCancel={cancel}
              />
            </>}</FormDialog>
          )}
          <Card className="p-0 overflow-hidden">
            <TableShell minWidth={640}>
              <Table>
                <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kontak</TableHead><TableHead>Alamat</TableHead><TableHead>Status</TableHead>{canWrite && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada mitra pemasok.</TableCell></TableRow>
                  ) : vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.contact || "-"}</TableCell>
                      <TableCell>{v.address || "-"}</TableCell>
                      <TableCell><Badge variant={v.is_active ? "default" : "outline"}>{v.is_active ? "aktif" : "nonaktif"}</Badge></TableCell>
                      {canWrite && (
                        <TableCell className="whitespace-nowrap">
                          <button type="button" className="p-1.5" title="Edit" onClick={() => { setError(""); setOperation("vendor"); setVendorEditingId(v.id); setVendorDefaults({ name: v.name, contact: v.contact || "", address: v.address || "" }); }}><Pencil  className="size-4" /></button>
                          <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => toggleVendorActive(v)}>{v.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </Card>
        </div>
      )}

      {tab === "customer" && (
        <div className="space-y-4">
          {canWrite && <Button onClick={() => { setError(""); setOperation("customer"); } }>Tambah Pelanggan</Button>}
          {canWrite && operation === "customer" && (
            <FormDialog title={customerEditingId ? 'Ubah Pelanggan' : 'Tambah Pelanggan'} onClose={closeCustomerForm} error={error}>{({ cancel, run }) => <>
              <PartnerFormCard
                kind="customer"
                editingId={customerEditingId}
                defaultValues={customerDefaults}
                onSubmit={v => run(() => submitCustomer(v))}
                onCancel={cancel}
              />
            </>}</FormDialog>
          )}
          <Card className="p-0 overflow-hidden">
            <TableShell minWidth={640}>
              <Table>
                <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kontak</TableHead><TableHead>Alamat</TableHead><TableHead>Status</TableHead>{canWrite && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada customer.</TableCell></TableRow>
                  ) : customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.contact || "-"}</TableCell>
                      <TableCell>{c.address || "-"}</TableCell>
                      <TableCell><Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "aktif" : "nonaktif"}</Badge></TableCell>
                      {canWrite && (
                        <TableCell className="whitespace-nowrap">
                          <button type="button" className="p-1.5" title="Edit" onClick={() => { setError(""); setOperation("customer"); setCustomerEditingId(c.id); setCustomerDefaults({ name: c.name, contact: c.contact || "", address: c.address || "" }); }}><Pencil  className="size-4" /></button>
                          <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => toggleCustomerActive(c)}>{c.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </Card>
        </div>
      )}

      {tab === "utang" && (
        <Card className="p-0 overflow-hidden">
          <TableShell minWidth={800}>
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Mitra Pemasok</TableHead><TableHead>Metode</TableHead><TableHead className="num">Total</TableHead><TableHead className="num">Terbayar</TableHead><TableHead className="num">Sisa</TableHead><TableHead>Jatuh tempo</TableHead><TableHead>Status</TableHead>{canWrite && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {purchases.filter((p) => p.payment_method === "credit").length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada utang usaha.</TableCell></TableRow>
                ) : purchases.filter((p) => p.payment_method === "credit").map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{String(p.invoice_number || "-")}</TableCell>
                    <TableCell>{String(p.vendor_name ?? "")}</TableCell>
                    <TableCell><Badge variant="secondary">{String(p.payment_method ?? "")}</Badge></TableCell>
                    <TableCell className="num">{fmtRp(Number(p.total_amount))}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p.paid_amount))}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p.outstanding))}</TableCell>
                    <TableCell>{p.due_date ? fmtDate(String(p.due_date)) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === "paid" ? "default" : "outline"}>{String(p.status ?? "")}</Badge>
                        {canWrite && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => cancelMovement(String(p.stock_card_id ?? ""))}>Batalkan</Button>
                        )}
                      </div>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        {p.status !== "paid" && (
                          <Button type="button" variant="outline" size="sm" onClick={() => payPurchase(p)}>Catat pelunasan</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </Card>
      )}

      {tab === "piutang" && (
        <Card className="p-0 overflow-hidden">
          <TableShell minWidth={800}>
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Metode</TableHead><TableHead className="num">Total</TableHead><TableHead className="num">Terbayar</TableHead><TableHead className="num">Sisa</TableHead><TableHead>Jatuh tempo</TableHead><TableHead>Status</TableHead>{canWrite && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {sales.filter((s) => s.payment_method === "piutang").length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada piutang usaha.</TableCell></TableRow>
                ) : sales.filter((s) => s.payment_method === "piutang").map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{String(s.invoice_number || "-")}</TableCell>
                    <TableCell>{String(s.customer_name ?? "")}</TableCell>
                    <TableCell><Badge variant="secondary">{String(s.payment_method ?? "")}</Badge></TableCell>
                    <TableCell className="num">{fmtRp(Number(s.total_amount))}</TableCell>
                    <TableCell className="num">{fmtRp(Number(s.paid_amount))}</TableCell>
                    <TableCell className="num">{fmtRp(Number(s.outstanding))}</TableCell>
                    <TableCell>{s.due_date ? fmtDate(String(s.due_date)) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === "paid" ? "default" : "outline"}>{String(s.status ?? "")}</Badge>
                        {canWrite && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => cancelMovement(String(s.stock_card_id ?? ""))}>Batalkan</Button>
                        )}
                      </div>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        {s.status !== "paid" && (
                          <Button type="button" variant="outline" size="sm" onClick={() => paySale(s)}>Catat pelunasan</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </Card>
      )}

    </div>
  );
}
