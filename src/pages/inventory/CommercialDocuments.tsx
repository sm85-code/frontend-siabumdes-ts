import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Plus, Trash2 } from "lucide-react";
import api, { fmtRp, fmtDate, getApiError } from "@/api/client";
import { triggerBlobDownload } from "@/api/transactions";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import TableShell from "@/components/TableShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSort } from "@/lib/useSort";
import type { InventoryProduct } from "@/types";

const BASE = "/v1/uu05_inventory/documents";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
type Kind = "invoice" | "po" | "purchase_statement";
type Partner = { id: string; name: string; address?: string };
type Source = {
  id: string;
  name: string;
  partner_id: string;
  date: string;
  quantity: number;
  invoice_number: string;
  total: string;
  paid: string;
  outstanding: string;
  issued: boolean;
  due_date?: string;
  payments: { date: string; amount: string; reference: string }[];
};
type Item = {
  source_id?: string;
  name: string;
  quantity: number;
  size: string;
  total: string;
};
type Doc = {
  id: string;
  number: string;
  kind: Kind;
  status: string;
  partner_name: string;
  issued_date: string;
  total: string;
  payment_info: string;
  items: Item[];
  payments?: Source[];
};
type Statement = {
  id: string;
  name: string;
  total: string;
  paid: string;
  outstanding: string;
  overdue_count: number;
  rows: Source[];
};
type PoLine = {
  product_id: string;
  date: string;
  size: string;
  order_code: string;
  quantity: string;
  price: string;
};
const labels: Record<Kind, string> = {
  invoice: "Invoice Pelanggan",
  po: "PO Pemasok",
  purchase_statement: "Rekap Pembelian",
};
const blankLine = (): PoLine => ({
  product_id: "",
  date: today(),
  size: "",
  order_code: "",
  quantity: "1",
  price: "",
});

export default function CommercialDocuments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("document");
  const canWrite = ["admin", "direktur", "bendahara", "pengelola"].includes(user?.role || "");
  const [kind, setKind] = useState<Kind>("invoice");
  const [view, setView] = useState<"documents" | "statements">("documents");
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partner, setPartner] = useState("");
  const [start, setStart] = useState(today().slice(0, 8) + "01");
  const [end, setEnd] = useState(today());
  const [docs, setDocs] = useState<Doc[]>([]);
  const [groups, setGroups] = useState<Statement[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<Doc | null>(null);
  const [statementDetail, setStatementDetail] = useState<Statement | null>(null);
  const [paymentGroup, setPaymentGroup] = useState<Statement | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState(today());
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issuedDate, setIssuedDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [info, setInfo] = useState("");
  const [poLines, setPoLines] = useState<PoLine[]>([blankLine()]);
  const [extras, setExtras] = useState<Record<string, { size: string; packing: string; processing: string }>>({});
  const statementKind = kind === "invoice" ? "invoice" : "purchase_statement";
  const params = useMemo(
    () => ({
      kind: statementKind,
      partner_id: partner || undefined,
      start: start || undefined,
      end: end || undefined,
    }),
    [statementKind, partner, start, end],
  );
  const sorter = useSort(groups, "name");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, d, g, catalog] = await Promise.all([
        api.get(`${BASE}/partners`, { params: { kind: statementKind } }),
        api.get(BASE, { params: { kind, offset } }),
        api.get(`${BASE}/statements`, { params }),
        api.get(`${BASE}/catalog`),
      ]);
      setProducts(catalog.data);
      setPartners(p.data);
      setDocs(d.data.items);
      setHasMore(d.data.has_more);
      setGroups(g.data);
    } catch (e) {
      setError(getApiError(e, "Gagal memuat dokumen"));
    } finally {
      setLoading(false);
    }
  }, [kind, offset, params, statementKind]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!documentId) return;
    let current = true;
    api
      .get(`${BASE}/${documentId}`)
      .then((r) => {
        if (current) setDetail(r.data);
      })
      .catch((e) => {
        if (current) setError(getApiError(e));
      });
    return () => {
      current = false;
    };
  }, [documentId]);
  useEffect(() => {
    if (!editing || kind === "po" || !partner) {
      setSources([]);
      return;
    }
    let current = true;
    setSources([]);
    setSelected(new Set());
    api
      .get(`${BASE}/sources`, { params })
      .then((r) => {
        if (current) setSources(r.data);
      })
      .catch((e) => {
        if (current) setError(getApiError(e));
      });
    return () => {
      current = false;
    };
  }, [editing, partner, kind, params]);

  const exportPdf = async (
    url: string,
    filename: string,
    preview = false,
    body?: unknown,
    selectedPartner?: string,
  ) => {
    // Open synchronously to avoid mobile popup blockers, then navigate to a blob URL.
    const target = preview ? window.open("", "_blank") : null;
    setBusy(true);
    setError("");
    try {
      const response = body
        ? await api.post(url, body, { responseType: "blob" })
        : await api.get(url, {
            params: url.includes("statements")
              ? { ...params, partner_id: selectedPartner || params.partner_id }
              : { inline: preview },
            responseType: "blob",
          });
      if (preview && target) {
        const blobUrl = URL.createObjectURL(response.data);
        target.opener = null;
        target.location.href = blobUrl;
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 300000);
      } else triggerBlobDownload(response.data, filename);
    } catch (e) {
      target?.close();
      const data = (e as { response?: { data?: unknown } }).response?.data;
      if (data instanceof Blob) {
        try {
          setError(JSON.parse(await data.text()).detail || "Gagal membuat PDF");
        } catch {
          setError("Gagal membuat PDF");
        }
      } else setError(getApiError(e, "Gagal membuat PDF"));
    } finally {
      setBusy(false);
    }
  };
  const payload = () => ({
    kind,
    partner_id: partner,
    period_start: start,
    period_end: end,
    issued_date: issuedDate,
    due_date: dueDate || null,
    payment_info: info,
    source_ids: kind === "po" ? [] : [...selected],
    lines:
      kind === "po"
        ? poLines.map((l) => ({
            ...l,
            quantity: Number(l.quantity),
            price: l.price,
          }))
        : [],
    allocations:
      kind === "invoice"
        ? [...selected].map((id) => ({
            source_id: id,
            size: extras[id]?.size || "",
            packing: extras[id]?.packing || "0",
            processing: extras[id]?.processing || "0",
          }))
        : [],
  });
  const valid = () => {
    if (!partner || !start || !end || start > end || !issuedDate || (dueDate && dueDate < issuedDate)) {
      setError("Pilih mitra dan isi tanggal/periode yang valid.");
      return false;
    }
    if (kind !== "po" && !selected.size) {
      setError("Pilih transaksi yang akan dimasukkan.");
      return false;
    }
    if (
      kind === "po" &&
      poLines.some(
        (l) =>
          !l.product_id ||
          !l.date ||
          l.date < start ||
          l.date > end ||
          !Number.isInteger(Number(l.quantity)) ||
          Number(l.quantity) < 1 ||
          !l.price ||
          !Number.isFinite(Number(l.price)) ||
          Number(l.price) < 0,
      )
    ) {
      setError("Lengkapi produk, tanggal dalam periode, jumlah, dan harga pada seluruh rincian PO.");
      return false;
    }
    return true;
  };
  const savePayments = async () => {
    if (!paymentGroup || !paymentDate) {
      setError("Pilih tanggal pembayaran.");
      return;
    }
    const allocations = paymentGroup.rows
      .filter((r) => Number(paymentAmounts[r.id]) > 0)
      .map((r) => ({ source_id: r.id, amount: paymentAmounts[r.id] }));
    if (
      !allocations.length ||
      allocations.some(
        (a) => Number(a.amount) > Number(paymentGroup.rows.find((r) => r.id === a.source_id)?.outstanding),
      )
    ) {
      setError("Isi nominal pembayaran yang tidak melebihi sisa tagihan.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post(`${BASE}/payments`, {
        kind: statementKind,
        partner_id: paymentGroup.id,
        paid_date: paymentDate,
        allocations,
      });
      setPaymentGroup(null);
      await load();
    } catch (e) {
      setError(getApiError(e, "Gagal mencatat pembayaran"));
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!valid()) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(BASE, payload());
      setEditing(false);
      setDetail(response.data);
      await load();
    } catch (e) {
      setError(getApiError(e, "Gagal menerbitkan dokumen"));
    } finally {
      setBusy(false);
    }
  };
  const total =
    kind === "po"
      ? poLines.reduce((sum, l) => sum + Number(l.price || 0) * Number(l.quantity || 0), 0)
      : sources.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + Number(s.total), 0);
  const openCreate = () => {
    setSelected(new Set());
    setExtras({});
    setIssuedDate(today());
    setDueDate("");
    setInfo("");
    setPoLines([blankLine()]);
    setError("");
    setEditing(true);
  };
  const field = (label: string, value: string, change: (value: string) => void, type = "text") => (
    <label className="grid gap-1 text-sm">
      {label}
      <Input type={type} value={value} onChange={(e) => change(e.target.value)} />
    </label>
  );
  const partnerSelect = (
    <label className="grid gap-1 text-sm">
      {kind === "invoice" ? "Pelanggan" : "Pemasok"}
      <select className="input" aria-label="Mitra dokumen" value={partner} onChange={(e) => setPartner(e.target.value)}>
        <option value="">Seluruh mitra / pilih mitra</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as Kind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? "default" : "outline"}
            onClick={() => {
              setKind(k);
              setPartner("");
              setOffset(0);
              setError("");
            }}
          >
            {labels[k]}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Invoice mengambil penjualan tercatat. PO adalah pemesanan, belum menambah stok atau jurnal. Rekap Pembelian
        merangkum barang yang sudah diterima. Periode dan pilihan mitra berlaku pada rekap dan pemilihan transaksi
        sumber.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {partnerSelect}
        {field("Tanggal awal", start, setStart, "date")}
        {field("Tanggal akhir", end, setEnd, "date")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "documents" ? "default" : "outline"} onClick={() => setView("documents")}>
          Daftar Dokumen
        </Button>
        <Button size="sm" variant={view === "statements" ? "default" : "outline"} onClick={() => setView("statements")}>
          Rekap per Mitra
        </Button>
        <Button size="sm" onClick={() => void load()} disabled={loading || busy}>
          Segarkan
        </Button>
        {canWrite && (
          <Button size="sm" className="sm:ml-auto" onClick={openCreate} disabled={busy}>
            <Plus className="size-4" />
            Buat {labels[kind]}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && <p role="status">Memuat dokumen dan rekap…</p>}
      {view === "documents" ? (
        <Card>
          <CardContent className="p-0">
            <TableShell minWidth={850}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor / Tanggal</TableHead>
                    <TableHead>Mitra</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.number}
                        <div className="text-xs text-muted-foreground">{fmtDate(d.issued_date)}</div>
                      </TableCell>
                      <TableCell>{d.partner_name}</TableCell>
                      <TableCell>{d.status === "void" ? "Dibatalkan" : "Diterbitkan"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{fmtRp(d.total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBusy(true);
                              api
                                .get(`${BASE}/${d.id}`)
                                .then((r) => setDetail(r.data))
                                .catch((e) => setError(getApiError(e)))
                                .finally(() => setBusy(false));
                            }}
                            disabled={busy}
                          >
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void exportPdf(`${BASE}/${d.id}/pdf`, d.number.replaceAll("/", "-") + ".pdf")
                            }
                          >
                            <Download className="size-4" />
                            Unduh PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!docs.length && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        Belum ada dokumen.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStart("");
                  setEnd("");
                }}
              >
                Seluruh periode
              </Button>
              <Button disabled={busy} onClick={() => void exportPdf(`${BASE}/statements/pdf`, "Rekap-Mitra.pdf")}>
                <Download className="size-4" />
                Unduh Rekap PDF
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Total berdasarkan transaksi pada periode terpilih; pembayaran dan sisa tagihan memakai posisi terbaru.
              Seluruh transaksi diambil, bukan hanya 100 baris pertama.
            </p>
            <TableShell minWidth={850}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      ["name", "Mitra"],
                      ["total", "Total Transaksi"],
                      ["paid", "Dibayar"],
                      ["outstanding", "Sisa Tagihan"],
                      ["overdue_count", "Jatuh Tempo"],
                    ].map(([key, label]) => (
                      <TableHead key={key}>
                        <button type="button" {...sorter.headerProps(key)}>
                          {label}
                          {sorter.sortIndicator(key)}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorter.sorted.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.name}</TableCell>
                      {(["total", "paid", "outstanding"] as const).map((k) => (
                        <TableCell key={k} className="whitespace-nowrap text-right">
                          {fmtRp(g[k])}
                        </TableCell>
                      ))}
                      <TableCell>{g.overdue_count} tagihan</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setStatementDetail(g)}>
                          Rincian
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!groups.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center">
                        Tidak ada transaksi dalam periode ini.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>
      )}
      {view === "documents" && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!offset || busy}
            onClick={() => setOffset((n) => Math.max(0, n - 50))}
          >
            Sebelumnya
          </Button>
          <Button size="sm" variant="outline" disabled={!hasMore || busy} onClick={() => setOffset((n) => n + 50)}>
            Berikutnya
          </Button>
        </div>
      )}
      <Dialog
        open={editing}
        onOpenChange={(v) => {
          if (!busy) setEditing(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat {labels[kind]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {partnerSelect}
              {field("Tanggal dokumen", issuedDate, setIssuedDate, "date")}
              {field("Jatuh tempo / target pembayaran", dueDate, setDueDate, "date")}
              {field("Periode mulai", start, setStart, "date")}
              {field("Periode akhir", end, setEnd, "date")}
            </div>
            {kind === "po" ? (
              <>
                <TableShell minWidth={1000}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {["Produk", "Tanggal selesai", "Kode pesanan", "Ukuran", "Qty", "Harga satuan", "Aksi"].map(
                          (h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poLines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <select
                              className="input min-w-48"
                              aria-label={`Produk PO ${i + 1}`}
                              value={l.product_id}
                              onChange={(e) =>
                                setPoLines((lines) =>
                                  lines.map((line, j) => (j === i ? { ...line, product_id: e.target.value } : line)),
                                )
                              }
                            >
                              <option value="">Pilih produk</option>
                              {products
                                .filter((p) => p.unit_usaha_id === user?.unit_usaha_id || user?.role !== "pengelola")
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </TableCell>
                          {(["date", "order_code", "size", "quantity", "price"] as const).map((k) => (
                            <TableCell key={k}>
                              <Input
                                aria-label={`${k} PO ${i + 1}`}
                                type={k === "date" ? "date" : k === "quantity" || k === "price" ? "number" : "text"}
                                min="0"
                                value={l[k]}
                                onChange={(e) =>
                                  setPoLines((lines) =>
                                    lines.map((line, j) => (j === i ? { ...line, [k]: e.target.value } : line)),
                                  )
                                }
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button
                              size="icon"
                              variant="outline"
                              aria-label={`Hapus baris PO ${i + 1}`}
                              disabled={poLines.length === 1}
                              onClick={() => setPoLines((lines) => lines.filter((_, j) => i !== j))}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableShell>
                <Button size="sm" variant="outline" onClick={() => setPoLines((lines) => [...lines, blankLine()])}>
                  <Plus className="size-4" />
                  Tambah barang
                </Button>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(new Set(sources.filter((s) => !s.issued).map((s) => s.id)))}
                  >
                    Pilih seluruh transaksi tersedia
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                    Hapus pilihan
                  </Button>
                </div>
                <TableShell minWidth={kind === "invoice" ? 1000 : 650}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          "Pilih",
                          "Tanggal / Invoice",
                          "Barang / Qty",
                          "Total",
                          ...(kind === "invoice" ? ["Ukuran", "Packing / Tambahan", "Proses Pesanan"] : []),
                        ].map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Checkbox
                              aria-label={`Pilih ${s.name} ${s.id}`}
                              disabled={s.issued}
                              checked={selected.has(s.id)}
                              onCheckedChange={(checked) =>
                                setSelected((old) => {
                                  const n = new Set(old);
                                  if (checked) n.add(s.id);
                                  else n.delete(s.id);
                                  return n;
                                })
                              }
                            />
                            {s.issued && <span className="ml-2 text-xs">Sudah diterbitkan</span>}
                          </TableCell>
                          <TableCell>
                            {fmtDate(s.date)}
                            <div className="text-xs">{s.invoice_number || "—"}</div>
                          </TableCell>
                          <TableCell>
                            {s.name} ×{s.quantity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fmtRp(s.total)}</TableCell>
                          {kind === "invoice" &&
                            (["size", "packing", "processing"] as const).map((k) => (
                              <TableCell key={k}>
                                <Input
                                  aria-label={`${k} ${s.id}`}
                                  type={k === "size" ? "text" : "number"}
                                  min="0"
                                  value={extras[s.id]?.[k] || ""}
                                  disabled={!selected.has(s.id)}
                                  onChange={(e) =>
                                    setExtras((old) => ({
                                      ...old,
                                      [s.id]: {
                                        ...(old[s.id] || {
                                          size: "",
                                          packing: "",
                                          processing: "",
                                        }),
                                        [k]: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </TableCell>
                            ))}
                        </TableRow>
                      ))}
                      {!sources.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center">
                            Pilih mitra dan periode yang memiliki transaksi tercatat.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableShell>
                {kind === "invoice" && (
                  <p className="text-xs text-muted-foreground">
                    Biaya tambahan merinci total transaksi yang sudah tercatat. Total invoice tetap sama; kolom harga
                    barang adalah sisa setelah rincian biaya.
                  </p>
                )}
              </>
            )}
            <p className="text-right font-semibold">Total: {fmtRp(total)}</p>
            <label className="grid gap-1 text-sm">
              Informasi pembayaran / rekening / ketentuan
              <textarea
                className="input min-h-24"
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                maxLength={3000}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Periksa pratinjau sebelum menerbitkan. Dokumen terbit diarsipkan dengan nomor otomatis dan tidak mengubah
              jurnal.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (valid()) void exportPdf(`${BASE}/preview`, "Pratinjau.pdf", true, payload());
                }}
              >
                <Eye className="size-4" />
                Pratinjau PDF
              </Button>
              <Button disabled={busy} onClick={() => void issue()}>
                <FileText className="size-4" />
                {busy ? "Memproses…" : "Terbitkan Dokumen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.number}</DialogTitle>
          </DialogHeader>
          {detail && (
            <>
              <p>
                {detail.partner_name} · {fmtDate(detail.issued_date)} ·{" "}
                {detail.status === "void" ? "Dibatalkan" : "Diterbitkan"}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void exportPdf(`${BASE}/${detail.id}/pdf`, "Dokumen.pdf", true)}
                >
                  <Eye className="size-4" />
                  Pratinjau / Cetak
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void exportPdf(`${BASE}/${detail.id}/pdf`, detail.number.replaceAll("/", "-") + ".pdf")
                  }
                >
                  <Download className="size-4" />
                  Unduh PDF
                </Button>
              </div>
              <TableShell minWidth={600}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barang</TableHead>
                      <TableHead>Ukuran</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((i, n) => (
                      <TableRow key={n}>
                        <TableCell>{i.name}</TableCell>
                        <TableCell>{i.size || "—"}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtRp(i.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
              <p className="text-right font-semibold">Total: {fmtRp(detail.total)}</p>
              <p className="whitespace-pre-line text-sm">{detail.payment_info}</p>
              {detail.payments && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Pembayaran dan sisa tagihan terbaru</h3>
                  {detail.payments.map((p) => (
                    <div key={p.id} className="rounded border p-3 text-sm">
                      <p>
                        {p.invoice_number || p.name} · Dibayar {fmtRp(p.paid)} · Sisa {fmtRp(p.outstanding)}
                      </p>
                      {p.payments.map((pay, n) => (
                        <p key={n} className="text-muted-foreground">
                          {fmtDate(pay.date)} · {fmtRp(pay.amount)}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
              {canWrite && detail.status !== "void" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm("Batalkan dokumen ini? Pembatalan dokumen tidak menghapus transaksi atau jurnal.")
                    )
                      return;
                    setBusy(true);
                    api
                      .post(`${BASE}/${detail.id}/void`)
                      .then((r) => {
                        setDetail(r.data);
                        void load();
                      })
                      .catch((e) => setError(getApiError(e)))
                      .finally(() => setBusy(false));
                  }}
                >
                  Batalkan Dokumen
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!statementDetail}
        onOpenChange={(v) => {
          if (!v) setStatementDetail(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rincian {statementDetail?.name}</DialogTitle>
          </DialogHeader>
          {statementDetail && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void exportPdf(`${BASE}/statements/pdf`, "Rekap-Mitra.pdf", false, undefined, statementDetail.id)
                }
              >
                <Download className="size-4" />
                Unduh Rekap PDF
              </Button>
              {canWrite && Number(statementDetail.outstanding) > 0 && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setPaymentGroup(statementDetail);
                    setStatementDetail(null);
                    setPaymentAmounts({});
                    setPaymentDate(today());
                    setError("");
                  }}
                >
                  {kind === "invoice" ? "Terima Pembayaran" : "Bayar Pemasok"}
                </Button>
              )}
            </div>
          )}
          {statementDetail && (
            <TableShell minWidth={750}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Tanggal / Invoice", "Barang", "Nilai", "Dibayar", "Sisa", "Pembayaran"].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementDetail.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {fmtDate(r.date)}
                        <div>{r.invoice_number || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {r.name} ×{r.quantity}
                      </TableCell>
                      {(["total", "paid", "outstanding"] as const).map((k) => (
                        <TableCell key={k} className="whitespace-nowrap">
                          {fmtRp(r[k])}
                        </TableCell>
                      ))}
                      <TableCell>
                        {r.payments.map((p, i) => (
                          <div key={i}>
                            {fmtDate(p.date)} · {fmtRp(p.amount)}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!paymentGroup}
        onOpenChange={(v) => {
          if (!busy && !v) setPaymentGroup(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {kind === "invoice" ? "Terima Pembayaran" : "Bayar Pemasok"} · {paymentGroup?.name}
            </DialogTitle>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {field("Tanggal pembayaran", paymentDate, setPaymentDate, "date")}
          <p className="text-sm text-muted-foreground">
            Isi nominal pada tagihan yang dibayar; kosongkan tagihan lainnya. Satu kali simpan dapat melunasi beberapa
            tagihan. Pembayaran membuat transaksi dan jurnal sesuai nominal masing-masing.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              setPaymentAmounts(
                Object.fromEntries(
                  paymentGroup?.rows.filter((r) => Number(r.outstanding) > 0).map((r) => [r.id, r.outstanding]) || [],
                ),
              )
            }
          >
            Isi seluruh sisa tagihan
          </Button>
          <TableShell minWidth={650}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice / Barang</TableHead>
                  <TableHead>Sisa tagihan</TableHead>
                  <TableHead>Nominal dibayar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentGroup?.rows
                  .filter((r) => Number(r.outstanding) > 0)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.invoice_number || "Tanpa nomor"} · {r.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtRp(r.outstanding)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={r.outstanding}
                          step="0.01"
                          aria-label={`Nominal pembayaran ${r.id}`}
                          value={paymentAmounts[r.id] || ""}
                          onChange={(e) => setPaymentAmounts((old) => ({ ...old, [r.id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableShell>
          <p className="text-right font-semibold">
            Total pembayaran: {fmtRp(Object.values(paymentAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0))}
          </p>
          <Button disabled={busy} onClick={() => void savePayments()}>
            {busy ? "Menyimpan…" : "Simpan Pembayaran"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
