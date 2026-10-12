import { expect, test } from '@playwright/test'

test('Riska uses agent conversation for free text and token-free shortcuts on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requests: Record<string, unknown>[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.endsWith('/auth/me')) body = { id: 'admin', name: 'Admin', username: 'admin', email: 'admin@test.local', role: 'admin', active: true }
    if (path.endsWith('/riska/availability')) body = { enabled: true, session_id: null, ai_models: { sol: { available: true, model: 'Sol' } } }
    if (path.endsWith('/riska/units')) body = [{ id: 'unit-1', code: 'UU01', name: 'Unit Satu' }]
    if (path.endsWith('/riska/chat')) {
      const request = route.request().postDataJSON()
      requests.push(request)
      body = { message: request.message === 'tahun 2026' ? 'Periode diganti menjadi tahun 2026.' : 'Berikut laporan resmi.', ai_conversation_id: 'conversation-1', rows: [{ entitas: 'Unit Satu', pendapatan: '100000', beban: '25000' }], money_columns: ['pendapatan', 'beban'] }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/profile')
  await page.getByRole('button', { name: '👩‍💼 Riska (Asisten Keuangan)', exact: true }).click()
  const widget = page.getByRole('complementary', { name: '👩‍💼 Riska (Asisten Keuangan)' })
  await expect(widget.getByRole('heading')).toHaveCSS('color', 'rgb(255, 255, 255)')
  const input = widget.getByRole('textbox', { name: 'Pesan untuk Riska' })
  await input.fill('bandingkan laba rugi unit aktif 6 bulan terakhir')
  await widget.getByRole('button', { name: 'Kirim', exact: true }).click()
  await expect(widget.getByRole('table')).toHaveCount(1)
  await input.fill('tahun 2026')
  await widget.getByRole('button', { name: 'Kirim', exact: true }).click()
  await expect(widget.getByRole('table')).toHaveCount(2)
  expect(requests[0].ai_mode).toBe('auto')
  expect(requests[1].ai_conversation_id).toBe('conversation-1')
  expect(requests[0].operation_id).toBeTruthy()
  await widget.getByRole('button', { name: 'Pintasan', exact: true }).click()
  await widget.getByRole('button', { name: '📊 Cek Laba Rugi', exact: true }).click()
  await expect(widget.getByRole('table')).toHaveCount(3)
  expect(requests[2].ai_mode).toBe('internal')
})
