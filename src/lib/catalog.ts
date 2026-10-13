/** Aturan murni tabel Katalog/Kategori Produk (diuji terpisah). */
export const DEFAULT_CATALOG_ROWS = 5
export const SKU_PREFIX = 'KRS.'

export type CatalogRow = {
  key: string
  id?: string
  category_id: string
  sku: string
  name: string
  unit_of_measure: string
  cost_price: string
  sell_price: string
}

export const skuPrefix = (categoryCode: string) => `${SKU_PREFIX}${categoryCode.toUpperCase()}-`
export const buildSku = (categoryCode: string, suffix: string) => `${skuPrefix(categoryCode)}${suffix.trim().toUpperCase()}`
export const isRowComplete = (r: Pick<CatalogRow, 'category_id' | 'sku' | 'name' | 'unit_of_measure'>) =>
  Boolean(r.category_id && r.sku.trim() && r.name.trim() && r.unit_of_measure.trim())

/** Tambah satu baris kosong bila baris terakhir diklik dan semua baris sebelumnya lengkap. */
export function shouldAppendRow(rows: CatalogRow[], clickedIndex: number): boolean {
  return clickedIndex === rows.length - 1 && rows.slice(0, -1).every(isRowComplete)
}
