import { useCallback, useEffect, useMemo, useState } from "react";
import HelpHint from "@/components/HelpHint";
import { Download, Eye, RefreshCw } from "lucide-react";
import SubTabs from "@/components/SubTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api, { fmtRp, fmtDate, getApiError } from "@/api/client";
import { triggerBlobDownload } from "@/api/transactions";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import TableShell from "@/components/TableShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSort } from "@/lib/useSort";
import { WEEKS, tradeWeek, tradeWeekLabel } from "@/lib/toko";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  doc_number?: string;
  total: string;
  paid: string;
  outstanding: string;
  issued: boolean;
  due_date?: string;
  payments: { date: string; amount: string; reference: string }[];
};
type Item = {
  source_id?: string;
  date?: string;
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
  period_end?: string;
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
const labels: Record<Kind, string> = {
  invoice: "Invoice Pelanggan",
  po: "PO Pemasok",
  purchase_statement: "Rekap Pembelian",
};
const hints: Record<Kind, string> = {
  invoice: "Dibuat dari penjualan yang sudah tercatat.",
  po: "Pemesanan ke pemasok; belum menambah stok atau jurnal.",
  purchase_statement: "Rangkuman barang yang sudah diterima dari pemasok.",
};
const ALL = "__all";

export default function CommercialDocuments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("document");
  const canWrite = ["admin", "direktur", "bendahara", "pengelola"].includes(user?.role || "");
  const [kind, setKind] = useState<Kind>("invoice");
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
  const [detail, setDetail] = useState<Doc | null>(null);
  const [statementDetail, setStatementDetail] = useState<Statement | null>(null);
  const [paymentGroup, setPaymentGroup] = useState<Statement | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState(today());
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
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, d, g] = await Promise.all([
        api.get(`${BASE}/partners`, { params: { kind: statementKind } }),
        api.get(BASE, { params: { kind, offset } }),
        api.get(`${BASE}/statements`, { params }),
      ]);
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

  const field = (label: string, value: string, change: (value: string) => void, type = "text") => (
    <label className="grid gap-1 text-sm">
      {label}
      <Input type={type} value={value} onChange={(e) => change(e.target.value)} />
    </label>
  );
  // Unduh PDF per minggu, sama seperti Catatan Gudang (Manajemen Toko).
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [weeklyNo, setWeeklyNo] = useState<Record<string, string>>({});
  // Nomor mingguan untuk dokumen otomatis (registri backend, tetap per mitra per minggu).
  const [groupNo, setGroupNo] = useState<Record<string, string>>({});
  useEffect(() => {
    setGroupNo({});
    const k = kind === "invoice" ? "invoice" : "po";
    void Promise.all(groups.filter((g) => g.rows.length).map((g) => {
      const days = weeksOf(g.rows.map((r) => ({ source_id: r.id, date: r.date }))).map(([key, w]) => [key, w.day] as const);
      return api.post(`${BASE}/weekly-numbers`, { kind: k, partner_id: g.id, dates: days.map(([, d]) => d).slice(0, 60) })
        .then((r) => days.map(([key, d]) => [`${g.id}|${key}`, (r.data[d] as string) ?? ""] as const))
        .catch(() => [] as (readonly [string, string])[]);
    })).then((pairs) => setGroupNo(Object.fromEntries(pairs.flat())));
  }, [groups, kind]);
  useEffect(() => {
    setWeeklyNo({});
    if (!statementDetail?.rows.length) return;
    api
      .post(`${BASE}/weekly-numbers`, {
        kind: kind === "invoice" ? "invoice" : "po",
        partner_id: statementDetail.id,
        dates: [...new Set(statementDetail.rows.map((r) => r.date))].slice(0, 60),
      })
      .then((r) => setWeeklyNo(r.data))
      .catch(() => setWeeklyNo({}));
  }, [statementDetail, kind]);
  const docWeeks = (d: Doc) => weeksOf((d.items ?? []).map((it) => ({ source_id: it.source_id, date: it.date })));
  const weeksOf = (list: { source_id?: string; date?: string }[]) => {
    const map = new Map<string, { period: string; w: number; ids: string[]; day: string }>();
    for (const it of list) {
      if (!it.source_id || !it.date) continue;
      const [y, m, day] = it.date.split("-").map(Number);
      const dt = new Date(y, m - 1, day);
      let period = it.date.slice(0, 7);
      let w = tradeWeek(period, dt);
      if (w == null) {
        const prev = new Date(y, m - 2, 1);
        period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
        w = tradeWeek(period, dt);
      }
      if (w == null) continue;
      const key = `${period}-minggu${w}`;
      const g = map.get(key) ?? { period, w, ids: [], day: it.date };
      g.ids.push(it.source_id);
      map.set(key, g);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const docFile = (d: Doc, suffix: string) =>
    `${d.kind === "invoice" ? "Invoice" : "PO"}-${(d.partner_name ?? "").replace(/[^\w-]+/g, "_")}-${suffix}.pdf`;
  const downloadDoc = (d: Doc, key: string | null, ids?: string[], day?: string) => {
    setOpenDoc(null);
    if (key && ids) void exportPdf(`${BASE}/transactions-pdf`, docFile(d, key), false, { kind: d.kind, source_ids: ids, week: day });
    else void exportPdf(`${BASE}/${d.id}/pdf`, docFile(d, (d.period_end ?? d.issued_date).slice(0, 7)));
  };
  // Rekap per Mitra: unduh langsung dari transaksi (tanpa dokumen terbit), sama seperti Catatan Gudang.
  const txKind = kind === "invoice" ? "invoice" : "po";
  const txLabel = kind === "invoice" ? "Invoice" : "PO";
  const groupFile = (g: Statement, suffix: string) => `${txLabel}-${(g.name ?? "").replace(/[^\w-]+/g, "_")}-${suffix}.pdf`;
  const downloadGroup = (g: Statement, key: string | null, ids: string[], day?: string) => {
    setOpenDoc(null);
    const last = g.rows.map((r) => r.date).sort().at(-1) ?? today();
    void exportPdf(`${BASE}/transactions-pdf`, groupFile(g, key ?? last.slice(0, 7)), false,
      { kind: txKind, source_ids: ids, ...(day ? { week: day } : {}) });
  };
  const groupMenu = (g: Statement, menuKey: string) => (
    <Popover open={openDoc === menuKey} onOpenChange={(o) => setOpenDoc(o ? menuKey : null)}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={busy || !g.rows.length}>
          <Download className="size-4" />
          Unduh PDF
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1">
        <div className="flex flex-col" role="menu" aria-label={`Periode ${txLabel} ${g.name}`}>
          {weeksOf(g.rows.map((r) => ({ source_id: r.id, date: r.date }))).map(([key, w]) => (
            <Button key={key} type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
              onClick={() => downloadGroup(g, key, w.ids, w.day)}>{tradeWeekLabel(w.period, w.w)}</Button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
            onClick={() => downloadGroup(g, null, g.rows.map((r) => r.id))}>Semua minggu</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
  // Dokumen otomatis dari transaksi: satu baris per mitra per minggu (seperti Catatan Gudang).
  const autoDocs = groups
    .flatMap((g) => weeksOf(g.rows.map((r) => ({ source_id: r.id, date: r.date }))).map(([key, w]) => ({
      g, key, w, total: g.rows.filter((r) => w.ids.includes(r.id)).reduce((t, r) => t + Number(r.total), 0),
    })))
    .sort((x, y) => y.key.localeCompare(x.key) || x.g.name.localeCompare(y.g.name));
  // Satu tabel: baris per mitra per minggu (Dibayar/Sisa/Jatuh Tempo dihitung dari transaksi minggu itu).
  const nowIso = today();
  const tableRows = autoDocs.map((a) => {
    const rows = a.g.rows.filter((r) => a.w.ids.includes(r.id));
    const sum = (k: "total" | "paid" | "outstanding") => rows.reduce((t, r) => t + Number(r[k]), 0);
    const overdue = rows.filter((r) => Number(r.outstanding) > 0 && r.due_date && r.due_date < nowIso).length;
    const wg: Statement = { ...a.g, rows, total: String(sum("total")), paid: String(sum("paid")), outstanding: String(sum("outstanding")), overdue_count: overdue };
    return {
      id: `${a.g.id}|${a.key}`, number: groupNo[`${a.g.id}|${a.key}`] || "", week: a.key, label: tradeWeekLabel(a.w.period, a.w.w),
      name: a.g.name, status: "Otomatis", total: sum("total"), paid: sum("paid"), outstanding: sum("outstanding"), overdue_count: overdue,
      g: a.g, wg,
    };
  });
  const tableSort = useSort(tableRows, "week");
  // Pilih minggu (Senin–Sabtu, seperti Unduh PDF Catatan Gudang): isi periode & tanggal dokumen (Sabtu).
  const weekPeriod = (start || today()).slice(0, 7);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const pickWeek = (w: string) => {
    const [y, m] = weekPeriod.split("-").map(Number);
    const mon = new Date(y, m - 1, 1);
    mon.setDate(1 + ((8 - mon.getDay()) % 7) + (Number(w) - 1) * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6); // transaksi hari Minggu ikut minggu ini
    setStart(iso(mon));
    setEnd(iso(sun));
  };
  const weekSelect = (
    <div className="grid gap-1 text-sm">
      <span>Minggu</span>
      <Select value={WEEKS.map(String).find((w) => { const [y, m] = weekPeriod.split("-").map(Number); const mon = new Date(y, m - 1, 1); mon.setDate(1 + ((8 - mon.getDay()) % 7) + (Number(w) - 1) * 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return start === iso(mon) && end === iso(sun); }) ?? ""} onValueChange={pickWeek}>
        <SelectTrigger aria-label="Pilih minggu"><SelectValue placeholder="Pilih minggu" /></SelectTrigger>
        <SelectContent>
          {WEEKS.map((w) => <SelectItem key={w} value={String(w)}>{tradeWeekLabel(weekPeriod, w)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
  const partnerSelect = (
    <div className="grid gap-1 text-sm">
      <span>{kind === "invoice" ? "Pelanggan" : "Pemasok"}</span>
      <Select value={partner || ALL} onValueChange={(v) => setPartner(v === ALL ? "" : v)}>
        <SelectTrigger aria-label="Mitra dokumen" className="h-10 w-full"><SelectValue /></SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={ALL}>Semua mitra</SelectItem>
          {partners.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  return (
    <div className="space-y-4">
      <SubTabs
        tabs={(["invoice", "po"] as Kind[]).map((k) => ({ id: k, label: k === "invoice" ? "INV Pelanggan" : labels[k] }))}
        value={kind}
        label="Jenis dokumen"
        testIdPrefix="doc-tab-"
        onChange={(k) => {
          setKind(k === "po" ? "po" : "invoice"); // Rekap Pembelian dihapus (sama dengan PO Pemasok)
          setPartner("");
          setOffset(0);
          setError("");
        }}
      />
      <div className="flex items-center gap-1 text-sm text-muted-foreground"><HelpHint><p>{hints[kind]}</p><p>Filter mitra dan periode berlaku untuk daftar, rekap, dan pemilihan transaksi sumber.</p></HelpHint></div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          {partnerSelect}
          {weekSelect}
          {field("Tanggal awal", start, setStart, "date")}
          {field("Tanggal akhir", end, setEnd, "date")}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading || busy} aria-label="Segarkan">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Segarkan
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { setStart(""); setEnd(""); }}>
            Seluruh periode
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void exportPdf(`${BASE}/statements/pdf`, "Rekap-Mitra.pdf")}>
            <Download className="size-4" />
            Unduh Rekap PDF
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && <p role="status">Memuat dokumen…</p>}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <TableShell minWidth={1100}>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    ["week", "Nomor / Minggu"],
                    ["name", "Mitra"],
                    ["status", "Status"],
                    ["total", "Total Transaksi"],
                    ["paid", "Dibayar"],
                    ["outstanding", "Sisa Tagihan"],
                    ["overdue_count", "Jatuh Tempo"],
                  ].map(([key, label]) => (
                    <TableHead key={key} className={["total", "paid", "outstanding"].includes(key) ? "text-right" : undefined}>
                      <button type="button" {...tableSort.headerProps(key)}>
                        {label}
                        {tableSort.sortIndicator(key)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableSort.sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.number || "—"}
                      <div className="text-xs text-muted-foreground">{r.label}</div>
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    {(["total", "paid", "outstanding"] as const).map((k) => (
                      <TableCell key={k} className="whitespace-nowrap text-right tabular-nums">{fmtRp(r[k])}</TableCell>
                    ))}
                    <TableCell>{r.overdue_count} tagihan</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setStatementDetail(r.wg)}>
                          Rincian
                        </Button>
                        {groupMenu(r.g, `t-${r.id}`)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.number}
                      <div className="text-xs text-muted-foreground">{fmtDate(d.issued_date)}</div>
                    </TableCell>
                    <TableCell>{d.partner_name}</TableCell>
                    <TableCell>{d.status === "void" ? "Dibatalkan" : "Diterbitkan"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{fmtRp(d.total)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">—</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">—</TableCell>
                    <TableCell>—</TableCell>
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
                        <Popover open={openDoc === d.id} onOpenChange={(o) => setOpenDoc(o ? d.id : null)}>
                          <PopoverTrigger asChild>
                            <Button size="sm" disabled={busy}>
                              <Download className="size-4" />
                              Unduh PDF
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-auto p-1">
                            <div className="flex flex-col" role="menu" aria-label={`Periode ${d.number}`}>
                              {(d.kind === "invoice" || d.kind === "po" ? docWeeks(d) : []).map(([key, g]) => (
                                <Button key={key} type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
                                  onClick={() => downloadDoc(d, key, g.ids, g.day)}>{tradeWeekLabel(g.period, g.w)}</Button>
                              ))}
                              <Button type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
                                onClick={() => downloadDoc(d, null)}>Semua minggu</Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!docs.length && !loading && !tableRows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center">
                      Tidak ada transaksi pada periode ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableShell>
          <p className="help-text mt-2">Dibayar dan sisa tagihan memakai posisi pembayaran terbaru.</p>
        </CardContent>
      </Card>
      {(offset > 0 || hasMore) && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={!offset || busy} onClick={() => setOffset((n) => Math.max(0, n - 50))}>
            Sebelumnya
          </Button>
          <Button size="sm" variant="outline" disabled={!hasMore || busy} onClick={() => setOffset((n) => n + 50)}>
            Berikutnya
          </Button>
        </div>
      )}
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
                        {p.doc_number || p.invoice_number || p.name} · Dibayar {fmtRp(p.paid)} · Sisa {fmtRp(p.outstanding)}
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
              {groupMenu(statementDetail, `d-${statementDetail.id}`)}
              <Button
                variant="outline"
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
                        <div>{r.doc_number || weeklyNo[r.date] || r.invoice_number || "—"}</div>
                        {r.doc_number && r.invoice_number && (
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Ref {r.invoice_number}</div>
                        )}
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
          <p className="page-sub">
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
                        {r.doc_number || r.invoice_number || "Tanpa nomor"} · {r.name}
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
