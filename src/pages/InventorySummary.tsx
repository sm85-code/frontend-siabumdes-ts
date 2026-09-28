// @ts-nocheck — mechanical F2 port from live FE; tighten types in follow-up
import { useMemo } from "react";
import { fmtRp, fmtDate } from "@/api/client";
import TableShell from "@/components/TableShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
} from "@/components/ui/chart";

const COLORS = ["var(--chart-1)", "var(--chart-5)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)", "var(--chart-6)"];
const TOP_OUT_CHART_CONFIG = { qty: { label: "Qty keluar", color: "var(--chart-1)" } };
function Stat({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="label mb-1">{label}</p>
        <p className="font-heading text-2xl font-bold">{value}</p>
        {hint ? <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Inventory Summary dashboard — KPI, charts, tables.
 * Props: products, movements, valuation, movementReport
 */
export default function InventorySummary({ products = [], movements = [], valuation = null, movementReport = null }) {
  const skuCount = valuation?.summary?.sku_count ?? products.length;
  const totalQty = valuation?.summary?.total_qty ?? products.reduce((s, p) => s + Number(p.qty_on_hand || 0), 0);
  const totalValue = Number(valuation?.summary?.total_value ?? products.reduce((s, p) => s + Number(p.stock_value || 0), 0));

  const lowStock = useMemo(
    () => [...products]
      .filter((p) => Number(p.qty_on_hand || 0) <= 5)
      .sort((a, b) => Number(a.qty_on_hand || 0) - Number(b.qty_on_hand || 0)),
    [products],
  );

  const topByValue = useMemo(
    () => [...products]
      .sort((a, b) => Number(b.stock_value || 0) - Number(a.stock_value || 0))
      .slice(0, 10),
    [products],
  );

  const topOut = useMemo(() => {
    const map = new Map();
    for (const m of movements) {
      if (m.direction !== "out" || m.finance_status === "cancelled") continue;
      const key = m.product_id || m.sku || m.id;
      const prev = map.get(key) || {
        product_id: m.product_id,
        sku: m.sku,
        name: m.product_name || m.sku || "—",
        qty: 0,
        value: 0,
        count: 0,
      };
      prev.qty += Number(m.quantity || 0);
      prev.value += Number(m.total_value || 0);
      prev.count += 1;
      if (m.sku) prev.sku = m.sku;
      if (m.product_name) prev.name = m.product_name;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [movements]);

  const categoryChart = useMemo(() => {
    const rows = valuation?.by_category || [];
    return rows
      .map((c) => ({
        name: c.category,
        value: Number(c.value || 0),
        qty: Number(c.qty || 0),
        sku_count: c.sku_count,
      }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [valuation]);

  const recentOut = useMemo(
    () => movements
      .filter((m) => m.direction === "out" && m.finance_status !== "cancelled")
      .slice(0, 8),
    [movements],
  );

  const outQty = movementReport?.stock_out?.qty ?? 0;
  const inQty = movementReport?.stock_in?.qty ?? 0;

  return (
    <div className="space-y-6" data-testid="inventory-summary">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="SKU aktif" value={skuCount} hint="Jumlah produk di katalog" />
        <Stat label="Total stok" value={totalQty} hint="Qty on hand seluruh SKU" />
        <Stat label="Nilai persediaan" value={fmtRp(totalValue)} hint="Qty × HPP" />
        <Stat
          label="Stok tipis"
          value={lowStock.length}
          hint="SKU dengan qty ≤ 5"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="label mb-1">Stock in (periode laporan)</p>
            <p className="font-heading text-xl font-bold">{inQty} unit</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {fmtRp(Number(movementReport?.stock_in?.value || 0))} · {movementReport?.stock_in?.count ?? 0} transaksi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="label mb-1">Stock out (periode laporan)</p>
            <p className="font-heading text-xl font-bold">{outQty} unit</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {fmtRp(Number(movementReport?.stock_out?.value || 0))} · {movementReport?.stock_out?.count ?? 0} transaksi
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
          <h3 className="font-heading text-lg font-semibold mb-1">Produk terlaris (stock out)</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Agregasi qty keluar dari mutasi terbaru (bukan dibatalkan).
          </p>
          {topOut.length > 0 ? (
            <ChartContainer config={TOP_OUT_CHART_CONFIG} className="w-full aspect-auto" style={{ height: 280 }}>
              <BarChart data={topOut} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--legacy-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v, name) => (name === "qty" ? `${v} unit` : fmtRp(v))}
                    />
                  }
                />
                <Bar dataKey="qty" name="qty" fill="var(--color-qty)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>
              Belum ada stock out untuk ditampilkan.
            </p>
          )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <h3 className="font-heading text-lg font-semibold mb-1">Nilai stok per kategori</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Berdasarkan valuasi persediaan saat ini.
          </p>
          {categoryChart.length > 0 ? (
            <ChartContainer config={{}} className="w-full aspect-auto" style={{ height: 280 }}>
              <PieChart>
                <Pie
                  data={categoryChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={44}
                >
                  {categoryChart.map((c, i) => (
                    <Cell key={c.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtRp(v)} />} />
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>
              Belum ada data valuasi kategori.
            </p>
          )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 pb-2">
            <h3 className="font-heading text-lg font-semibold">Top nilai persediaan</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>10 SKU dengan nilai stok tertinggi</p>
          </div>
          <TableShell minWidth={640}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead><TableHead>Nama</TableHead><TableHead className="num">Qty</TableHead><TableHead className="num">Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topByValue.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada produk.</TableCell></TableRow>
              ) : topByValue.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="num">{p.qty_on_hand}</TableCell>
                  <TableCell className="num">{fmtRp(Number(p.stock_value || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableShell>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="p-4 pb-2">
            <h3 className="font-heading text-lg font-semibold">Peringatan stok tipis</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>SKU dengan qty on hand ≤ 5</p>
          </div>
          <TableShell minWidth={640}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead><TableHead className="num">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Semua stok aman (&gt; 5).</TableCell></TableRow>
              ) : lowStock.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.category_name || "-"}</Badge></TableCell>
                  <TableCell className={`num ${Number(p.qty_on_hand) === 0 ? "text-destructive font-semibold" : ""}`}>
                    {p.qty_on_hand}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableShell>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 pb-2">
          <h3 className="font-heading text-lg font-semibold">Stock out terbaru</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Mutasi keluar terakhir</p>
        </div>
        <TableShell minWidth={640}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead><TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead className="num">Qty</TableHead><TableHead className="num">Nilai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOut.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada stock out.</TableCell></TableRow>
            ) : recentOut.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{fmtDate(m.movement_date)}</TableCell>
                <TableCell>{m.sku}</TableCell>
                <TableCell>{m.product_name}</TableCell>
                <TableCell className="num">{m.quantity}</TableCell>
                <TableCell className="num">{fmtRp(Number(m.total_value || 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableShell>
      </Card>
    </div>
  );
}
