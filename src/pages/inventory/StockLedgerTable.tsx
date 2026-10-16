import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtRp, fmtDate } from "@/api/client";
import TableShell from "@/components/TableShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useSort } from "@/lib/useSort";
import { currentMonth, monthRange, searchRows, totals, type StockRow } from "@/lib/stockList";

const BASE = "/v1/uu05_inventory";
const PER_PAGE = 20;

type Row = StockRow & { status?: string; kind?: string; reason?: string; notes?: string; hasRef: boolean; nota?: string; invoice?: string };

export default function StockLedgerTable({
  kind,
  refreshKey,
  onCancel,
}: {
  kind: "in" | "out" | "adjust";
  refreshKey?: unknown;
  onCancel?: (id: string) => void;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [raw, setRaw] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const range = month ? monthRange(month) : {};
    const req = kind === "adjust"
      ? api.get(`${BASE}/adjustments`, { params: { ...range, limit: 2000 } })
      : api.get(`${BASE}/movements`, { params: { ...range, direction: kind, limit: 2000 } });
    req.then((r) => {
      if (!alive) return;
      const data: Record<string, unknown>[] = Array.isArray(r.data) ? r.data : [];
      setErr("");
      setRaw(data.filter((d) => d.finance_status !== "cancelled").map((d) => kind === "adjust" ? {
        id: String(d.id), date: String(d.adjustment_date ?? ""), sku: String(d.sku ?? ""), product: String(d.product_name ?? ""),
        qty: Number(d.quantity_delta) || 0, value: null, reason: String(d.reason ?? ""), notes: String(d.notes ?? ""), hasRef: true,
      } : {
        id: String(d.id), date: String(d.movement_date ?? ""), sku: String(d.sku ?? ""), product: String(d.product_name ?? ""),
        qty: Number(d.quantity) || 0, value: Number(d.total_value) || 0, status: String(d.finance_status ?? ""),
        kind: String(d.movement_kind ?? ""), hasRef: Boolean(d.reference),
        nota: String(d.nota_id ?? d.id), invoice: String(d.invoice_number ?? ""),
      }));
    }).catch((e) => alive && setErr(String((e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail ?? "Gagal memuat daftar")));
    return () => { alive = false; };
  }, [kind, month, refreshKey]);

  const filtered = useMemo(() => searchRows(raw, q), [raw, q]);
  const { sorted, headerProps, sortIndicator } = useSort(filtered, "date", "desc");
  const sum = totals(filtered);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const cur = Math.min(page, pageCount);
  const shown = sorted.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const isAdj = kind === "adjust";
  const cols = 6 + (onCancel ? 1 : 0);

  const H = ({ k, label, num }: { k: string; label: string; num?: boolean }) => {
    const p = headerProps(k);
    return <TableHead {...p} className={`${p.className}${num ? " num" : ""} whitespace-nowrap`}>{label}{sortIndicator(k)}</TableHead>;
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap gap-2 p-3">
        <Input type="month" aria-label="Periode" className="w-40" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} />
        <Input type="search" aria-label="Cari produk/SKU" placeholder="Cari produk/SKU" className="flex-1 min-w-40" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {err && <p className="px-3 pb-2 text-sm text-red-600">{err}</p>}
      <TableShell minWidth={720}>
        <Table>
          <TableHeader>
            <TableRow>
              <H k="date" label="Tanggal" /><H k="product" label="Produk" /><H k="qty" label={isAdj ? "Delta" : "Qty"} num />
              {isAdj ? <TableHead>Alasan</TableHead> : <H k="value" label="Nilai" num />}
              <TableHead>{isAdj ? "Catatan" : "Status"}</TableHead><TableHead>Ref</TableHead>{onCancel && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow><TableCell colSpan={cols} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Tidak ada data.</TableCell></TableRow>
            ) : shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                <TableCell><div>{r.product}</div><div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.sku}{r.invoice ? ` · ${r.invoice}` : ""}</div></TableCell>
                <TableCell className="num">{isAdj && r.qty > 0 ? `+${r.qty}` : r.qty}</TableCell>
                {isAdj ? <TableCell><Badge variant="secondary">{r.reason}</Badge></TableCell> : <TableCell className="num">{fmtRp(r.value ?? 0)}</TableCell>}
                <TableCell>
                  {isAdj ? (r.notes || "-") : <>
                    <Badge variant="secondary">{r.status}</Badge>
                    {r.kind === "internal_use" && <Badge variant="outline" className="ml-1">Internal</Badge>}
                  </>}
                </TableCell>
                <TableCell className="">
                  {r.hasRef ? <Link to={`/transactions?reference=${encodeURIComponent(r.nota || r.id)}`} className="underline" style={{ color: "var(--primary-dark)" }}>Lihat transaksi</Link> : "-"}
                </TableCell>
                {onCancel && <TableCell><Button type="button" variant="outline" size="sm" onClick={() => onCancel(r.id)}>Batalkan</Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
            <tfoot className="border-t">
              <TableRow className="font-medium">
                <TableCell colSpan={2}>Total ({filtered.length})</TableCell>
                <TableCell className="num">{sum.qty}</TableCell>
                <TableCell className="num">{isAdj ? "" : fmtRp(sum.value)}</TableCell>
                <TableCell colSpan={cols - 4} />
              </TableRow>
            </tfoot>
          )}
        </Table>
      </TableShell>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 p-3 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</Button>
          <span>{cur} / {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>›</Button>
        </div>
      )}
    </Card>
  );
}
