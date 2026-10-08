import { ArrowDown, ArrowUp, BarChart3, HandCoins, Package, Pencil, PieChart, Plus, SlidersHorizontal, Trash2, Truck, Users, Wallet } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
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
import InventorySummary from "@/pages/InventorySummary";
import ProductFormCard from "@/pages/inventory/ProductFormCard";
import StockInFormCard from "@/pages/inventory/StockInFormCard";
import StockOutFormCard from "@/pages/inventory/StockOutFormCard";
import AdjustFormCard from "@/pages/inventory/AdjustFormCard";
import PartnerFormCard from "@/pages/inventory/PartnerFormCard";
import {
  emptyPartnerFormValues,
  emptyProductForm,
  type AdjustFormValues,
  type PartnerFormValues,
  type ProductFormValues,
  type StockInFormValues,
  type StockOutFormValues,
} from "@/schemas/inventory";
import PeriodFilter from "@/components/PeriodFilter";
import TableShell from "@/components/TableShell";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const TABS = [
  { id: "summary", label: "Summary", icon: PieChart },
  { id: "katalog", label: "Katalog Produk", icon: Package },
  { id: "stock-in", label: "Stock In", icon: ArrowDown },
  { id: "stock-out", label: "Stock Out", icon: ArrowUp },
  { id: "kelola", label: "Penyesuaian Stok", icon: SlidersHorizontal },
  { id: "vendor", label: "Mitra Pemasok", icon: Truck },
  { id: "customer", label: "Customer", icon: Users },
  { id: "utang", label: "Utang", icon: Wallet },
  { id: "piutang", label: "Piutang", icon: HandCoins },
  { id: "laporan", label: "Laporan", icon: BarChart3 },
];

export default function Inventory() {
  const { user } = useAuth();
  const [tab, setTab] = useState("summary");
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
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productDefaults, setProductDefaults] = useState<ProductFormValues>(emptyProductForm());
  const [vendorEditingId, setVendorEditingId] = useState<string | null>(null);
  const [vendorDefaults, setVendorDefaults] = useState<PartnerFormValues>(emptyPartnerFormValues());
  const [customerEditingId, setCustomerEditingId] = useState<string | null>(null);
  const [customerDefaults, setCustomerDefaults] = useState<PartnerFormValues>(emptyPartnerFormValues());
  const [period, setPeriod] = useState<PeriodValue>({
    mode: "monthly", startDate: "", endDate: "", label: "",
  });

  const canAccessRole = can(user, "admin", "direktur", "bendahara", "pengelola");
  const canWrite = can(user, "admin", "direktur", "bendahara", "pengelola");

  const loadCore = useCallback(async () => {
    setError("");
    try {
      const [m, p, c] = await Promise.all([
        api.get(`${BASE}/meta`),
        api.get(`${BASE}/products`, { params: { q: q || undefined, category_id: catFilter || undefined } }),
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
  }, [q, catFilter]);

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
    if (tab === "laporan" || tab === "summary") loadReports();
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

  const openCreateProduct = () => {
    setEditingId(null);
    setProductDefaults(emptyProductForm());
    setShowForm(true);
  };

  const openEditProduct = (p: InventoryProduct) => {
    setEditingId(p.id);
    setProductDefaults({
      sku: p.sku,
      name: p.name,
      category_id: p.category_id || "",
      unit_of_measure: p.unit_of_measure || "pcs",
      cost_price: String(Number(p.cost_price || 0)),
      sell_price: String(Number(p.sell_price || 0)),
      opening_qty: "0",
    });
    setShowForm(true);
  };

  const closeProductForm = () => {
    setShowForm(false);
    setEditingId(null);
    setProductDefaults(emptyProductForm());
  };

  const submitProduct = async (values: ProductFormValues) => {
    try {
      if (editingId) {
        await api.put(`${BASE}/products/${editingId}`, {
          name: values.name,
          category_id: values.category_id,
          unit_of_measure: values.unit_of_measure,
          cost_price: Number(values.cost_price || 0),
          sell_price: Number(values.sell_price || 0),
        });
      } else {
        await api.post(`${BASE}/products`, {
          sku: values.sku,
          name: values.name,
          category_id: values.category_id,
          unit_of_measure: values.unit_of_measure,
          cost_price: Number(values.cost_price || 0),
          sell_price: Number(values.sell_price || 0),
          opening_qty: Number(values.opening_qty || 0),
          unit_usaha_id: meta?.unit_usaha_id,
        });
      }
      closeProductForm();
      loadCore();
    } catch (err) {
      setError(formatApiError(err, "Gagal menyimpan produk"));
    }
  };

  const removeProduct = async (id: string) => {
    if (!window.confirm("Hapus produk ini? Stok harus 0. Riwayat mutasi/penyesuaian & jurnal terkait ikut dihapus.")) return;
    try {
      await api.delete(`${BASE}/products/${id}`);
      loadCore();
    } catch (err) {
      setError(formatApiError(err, "Gagal menghapus produk"));
    }
  };

  const submitStockIn = async (values: StockInFormValues) => {
    try {
      await api.post(`${BASE}/stock-in`, {
        ...values,
        quantity: Number(values.quantity),
        unit_cost: Number(values.unit_cost),
        due_date: values.payment_method === "credit" ? values.due_date : null,
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

  const payPurchase = async (purchase: InventoryPurchase) => {
    const amountStr = window.prompt(
      `Jumlah pelunasan utang (sisa ${fmtRp(Number(purchase.outstanding))}):`,
      String(purchase.outstanding ?? ""),
    );
    if (!amountStr) return;
    try {
      await api.post(`${BASE}/purchases/pay`, {
        purchase_id: purchase.id,
        amount: Number(amountStr),
        paid_date: today(),
        debit_account_code: UTANG_ACCOUNT_CODE,
        credit_account_code: KAS_ACCOUNT_CODE,
        unit_usaha_id: meta?.unit_usaha_id,
      });
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err, "Gagal mencatat pelunasan"));
    }
  };

  const paySale = async (sale: InventorySale) => {
    const amountStr = window.prompt(
      `Jumlah pelunasan piutang (sisa ${fmtRp(Number(sale.outstanding))}):`,
      String(sale.outstanding ?? ""),
    );
    if (!amountStr) return;
    try {
      await api.post(`${BASE}/sales/pay`, {
        sale_id: sale.id,
        amount: Number(amountStr),
        paid_date: today(),
        debit_account_code: KAS_ACCOUNT_CODE,
        credit_account_code: PIUTANG_ACCOUNT_CODE,
        unit_usaha_id: meta?.unit_usaha_id,
      });
      await loadTrade();
    } catch (err) {
      setError(formatApiError(err, "Gagal mencatat pelunasan"));
    }
  };

  return (
    <div className="space-y-6 fade-in" data-testid="inventory-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">{meta?.unit_code ? `Unit Usaha ${meta.unit_code}` : "Unit Usaha"}</p>
          <h1 className="font-heading text-3xl font-bold">Manajemen Stok</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {meta?.unit_name || "Persediaan barang dagang"} · katalog, mutasi, pembelian, penjualan & valuasi
          </p>
        </div>
        {tab === "katalog" && canWrite && (
          <Button type="button" onClick={openCreateProduct} data-testid="btn-new-product">
            <Plus  className="size-4" /> Tambah Produk
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-3 text-sm" style={{ borderColor: "var(--status-error)", color: "var(--status-error-strong)", background: "var(--status-error-bg)" }} role="alert" data-testid="inventory-error">
          <strong className="block mb-1">Validasi / API</strong>
          <span>{typeof error === "string" ? error : JSON.stringify(error)}</span>
          <button type="button" className="ml-3 underline" onClick={() => setError("")}>tutup</button>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Tab inventory">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <Button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
            >
              <Icon size={16} /> {t.label}
            </Button>
          );
        })}
      </div>

      {tab === "summary" && (
        <InventorySummary
          products={products}
          movements={movements}
          valuation={valuation}
          movementReport={movementReport}
        />
      )}

      {tab === "katalog" && (
        <div className="space-y-4">
          <Card className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            <div>
              <label className="label">Cari SKU / nama</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="contoh: KIPAS" />
            </div>
            <div>
              <label className="label">Kategori</label>
              <Select value={catFilter || "__all__"} onValueChange={(v) => setCatFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua kategori</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {showForm && canWrite && (
            <ProductFormCard
              editingId={editingId}
              defaultValues={productDefaults}
              categories={categories}
              onSubmit={submitProduct}
              onCancel={closeProductForm}
            />
          )}

          <Card className="p-0 overflow-hidden">
            <TableShell minWidth={720}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead><TableHead>Satuan</TableHead>
                  <TableHead className="num">HPP</TableHead><TableHead className="num">Harga jual</TableHead>
                  <TableHead className="num">Stok</TableHead><TableHead className="num">Nilai</TableHead>
                  {canWrite && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada produk di katalog.</TableCell></TableRow>
                ) : products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.sku}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.category_name || "-"}</Badge></TableCell>
                    <TableCell>{p.unit_of_measure}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p.cost_price))}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p.sell_price))}</TableCell>
                    <TableCell className="num">{p.qty_on_hand}</TableCell>
                    <TableCell className="num">{fmtRp(Number(p.stock_value))}</TableCell>
                    {canWrite && (
                      <TableCell className="whitespace-nowrap">
                        <button type="button" className="p-1.5" title="Edit" onClick={() => openEditProduct(p)} data-testid={`btn-edit-product-${p.id}`}>
                          <Pencil  className="size-4" />
                        </button>
                        <button type="button" className="p-1.5" title="Hapus" onClick={() => removeProduct(p.id)}>
                          <Trash2  className="size-4" />
                        </button>
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

      {tab === "stock-in" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-2">Penerimaan barang (Stock In / Pembelian)</p>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>Stock in menghasilkan transaksi stok masuk sekaligus transaksi Pembelian (tunai atau kredit/utang).</p>
            {canWrite ? (
              <StockInFormCard
                products={products}
                vendors={activeVendors}
                onSubmit={submitStockIn}
              />
            ) : <p className="text-sm">Role Anda read-only.</p>}
          </CardContent>
          </Card>
          <MovementTable rows={movements.filter((m) => m.direction === "in" && m.finance_status !== "cancelled")} onCancel={canWrite ? cancelMovement : undefined} />
        </div>
      )}

      {tab === "stock-out" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-2">Pengeluaran barang (Stock Out / Penjualan)</p>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Centang pemakaian internal untuk beban tanpa jurnal penjualan; tanpa centang = stock out penjualan (HPP + pendapatan, tunai/piutang).
            </p>
            {canWrite ? (
              <StockOutFormCard
                products={products}
                customers={activeCustomers}
                onSubmit={submitStockOut}
                onClientError={setError}
              />
            ) : <p className="text-sm">Role Anda read-only.</p>}
          </CardContent>
          </Card>
          <MovementTable rows={movements.filter((m) => m.direction === "out" && m.finance_status !== "cancelled")} onCancel={canWrite ? cancelMovement : undefined} />
        </div>
      )}

      {tab === "kelola" && (
        <div className="space-y-4">
          <Card>
          <CardContent className="pt-6">
            <p className="label mb-2">Penyesuaian Stok</p>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Pengurangan stok (delta negatif) menghasilkan 2 transaksi: pengurangan fisik nilai persediaan, lalu pengakuan beban kerugian.
              Penambahan stok (delta positif) tetap 1 jurnal dengan akun kredit/offset pilihan Anda.
            </p>
            {canWrite ? (
              <AdjustFormCard products={products} onSubmit={submitAdjust} />
            ) : <p className="text-sm">Role Anda read-only.</p>}
          </CardContent>
          </Card>

          <Card className="p-0 overflow-hidden">
            <TableShell minWidth={720}>
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead className="num">Delta</TableHead><TableHead>Alasan</TableHead><TableHead>Catatan</TableHead><TableHead>Ref</TableHead>{canWrite && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {adjustments.length === 0 ? (
                  <TableRow><TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada penyesuaian.</TableCell></TableRow>
                ) : adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{fmtDate(a.adjustment_date)}</TableCell>
                    <TableCell>{a.sku}</TableCell>
                    <TableCell>{a.product_name}</TableCell>
                    <TableCell className="num">{Number(a.quantity_delta) > 0 ? `+${a.quantity_delta}` : a.quantity_delta}</TableCell>
                    <TableCell><Badge variant="secondary">{a.reason}</Badge></TableCell>
                    <TableCell>{a.notes || "-"}</TableCell>
                    <TableCell className="text-xs">
                      <Link
                        to={`/transactions?reference=${encodeURIComponent(a.id)}`}
                        className="underline"
                        style={{ color: "var(--primary-dark)" }}
                      >
                        Lihat transaksi
                      </Link>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" onClick={() => cancelAdjustment(a.id)}>
                          Batalkan
                        </Button>
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

      {tab === "vendor" && (
        <div className="space-y-4">
          {canWrite && (
            <PartnerFormCard
              kind="vendor"
              editingId={vendorEditingId}
              defaultValues={vendorDefaults}
              onSubmit={submitVendor}
              onCancel={closeVendorForm}
            />
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
                          <button type="button" className="p-1.5" title="Edit" onClick={() => { setVendorEditingId(v.id); setVendorDefaults({ name: v.name, contact: v.contact || "", address: v.address || "" }); }}><Pencil  className="size-4" /></button>
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
          {canWrite && (
            <PartnerFormCard
              kind="customer"
              editingId={customerEditingId}
              defaultValues={customerDefaults}
              onSubmit={submitCustomer}
              onCancel={closeCustomerForm}
            />
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
                          <button type="button" className="p-1.5" title="Edit" onClick={() => { setCustomerEditingId(c.id); setCustomerDefaults({ name: c.name, contact: c.contact || "", address: c.address || "" }); }}><Pencil  className="size-4" /></button>
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

      {tab === "laporan" && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Periode</label>
              <PeriodFilter
                value={period}
                onChange={setPeriod}
                defaultMode="monthly"
                data-testid="inventory-period-filter"
              />
            </div>
            <Button type="button" variant="outline" onClick={loadReports}>Muat ulang</Button>
          </Card>

          {valuation && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="SKU aktif" value={valuation.summary?.sku_count ?? 0} />
              <Stat label="Total qty" value={valuation.summary?.total_qty ?? 0} />
              <Stat label="Nilai persediaan" value={fmtRp(Number(valuation.summary?.total_value || 0))} />
            </div>
          )}

          {movementReport && (
            <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="label mb-1">Stock in</p>
                <p className="font-heading text-xl font-bold">{movementReport.stock_in?.qty ?? 0} unit</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{fmtRp(Number(movementReport.stock_in?.value || 0))} · {movementReport.stock_in?.count ?? 0} transaksi</p>
              </div>
              <div>
                <p className="label mb-1">Stock out</p>
                <p className="font-heading text-xl font-bold">{movementReport.stock_out?.qty ?? 0} unit</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{fmtRp(Number(movementReport.stock_out?.value || 0))} · {movementReport.stock_out?.count ?? 0} transaksi</p>
              </div>
            </Card>
          )}

          {(valuation?.by_category?.length ?? 0) > 0 && (
            <Card className="p-0 overflow-hidden">
              <TableShell minWidth={720}>
              <Table>
                <TableHeader><TableRow><TableHead>Kategori</TableHead><TableHead className="num">SKU</TableHead><TableHead className="num">Qty</TableHead><TableHead className="num">Nilai</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(valuation?.by_category ?? []).map((c) => (
                    <TableRow key={c.category}>
                      <TableCell>{c.category}</TableCell>
                      <TableCell className="num">{c.sku_count}</TableCell>
                      <TableCell className="num">{c.qty}</TableCell>
                      <TableCell className="num">{fmtRp(Number(c.value))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableShell>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="label mb-1">{label}</p>
      <p className="font-heading text-2xl font-bold">{value}</p>
    </Card>
  );
}

function MovementTable({
  rows,
  onCancel,
}: {
  rows: InventoryMovement[]
  onCancel?: (id: string) => void
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <TableShell minWidth={720}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead><TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead className="num">Qty</TableHead>
            <TableHead className="num">Nilai</TableHead><TableHead>Status</TableHead><TableHead>Ref</TableHead>{onCancel && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada mutasi.</TableCell></TableRow>
          ) : rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{fmtDate(m.movement_date)}</TableCell>
              <TableCell>{m.sku}</TableCell>
              <TableCell>{m.product_name}</TableCell>
              <TableCell className="num">{m.quantity}</TableCell>
              <TableCell className="num">{fmtRp(Number(m.total_value))}</TableCell>
              <TableCell>
                <Badge variant="secondary">{m.finance_status}</Badge>
                {m.movement_kind === "internal_use" && <Badge variant="outline" className="ml-1">Internal</Badge>}
              </TableCell>
              <TableCell className="text-xs">
                {m.reference ? (
                  <Link
                    to={`/transactions?reference=${encodeURIComponent(m.id)}`}
                    className="underline"
                    style={{ color: "var(--primary-dark)" }}
                  >
                    Lihat transaksi
                  </Link>
                ) : (
                  "-"
                )}
              </TableCell>
              {onCancel && (
                <TableCell>
                  {m.finance_status !== "cancelled" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onCancel(m.id)}>Batalkan</Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableShell>
    </Card>
  );
}
