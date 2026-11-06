import { expect, test } from '@playwright/test'

test('disabled Riska hides all entries and never polls, even after focus or direct navigation', async ({ page }) => {
  test.skip(process.env.VITE_RISKA_ENABLED === 'true', 'Disabled-build coverage')
  const riskaRequests: string[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/riska')) riskaRequests.push(path)
    const body = path.endsWith('/auth/me')
      ? { id: 'admin', name: 'Admin', username: 'admin', role: 'admin', active: true }
      : path.endsWith('/riska/availability') ? { enabled: true } : []
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: /Riska/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Riska/ })).toHaveCount(0)
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(11_000)
  await page.goto('/riska-permissions')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Penugasan Asisten Riska')).toHaveCount(0)
  await page.waitForTimeout(6_000)
  expect(riskaRequests).toEqual([])
})
