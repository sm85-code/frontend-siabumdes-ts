import { expect, test, type Page, type Route } from '@playwright/test'

/** Default: no real backend — auth and other /api calls return 401. */
async function mockApiUnauthenticated(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    })
  })
}

/** Public landing: mock summary JSON; everything else still 401. */
async function mockPublicSummary(page: Page) {
  const summary = {
    year: 2026,
    total_pendapatan: '1500000.00',
    total_beban: '500000.00',
    laba_bersih: '1000000.00',
    pades_estimasi: '300000.00',
    trend: [
      { month: '2026-01', pendapatan: '100000', beban: '40000' },
      { month: '2026-02', pendapatan: '120000', beban: '45000' },
    ],
  }
  await page.route('**/api/**', async (route: Route) => {
    const url = route.request().url()
    if (url.includes('/public/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summary),
      })
      return
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('bumdes_user')
    } catch {
      /* ignore */
    }
  })
})

test('login page renders (no API)', async ({ page }) => {
  await mockApiUnauthenticated(page)
  await page.goto('/login')

  await expect(page.getByTestId('bumdes-logo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Masuk ke Akun' })).toBeVisible()
  await expect(page.getByTestId('login-username')).toBeVisible()
  await expect(page.getByTestId('login-password')).toBeVisible()
  await expect(page.getByTestId('login-submit')).toBeVisible()
  await expect(page.getByTestId('login-back')).toBeVisible()
})

test('protected /dashboard redirects to /login when unauthenticated', async ({ page }) => {
  await mockApiUnauthenticated(page)
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByTestId('login-submit')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Masuk ke Akun' })).toBeVisible()
})

test('login empty submit shows Indonesian validation messages', async ({ page }) => {
  await mockApiUnauthenticated(page)
  await page.goto('/login')

  await page.getByTestId('login-submit').click()

  await expect(page.getByText('Username / email wajib diisi')).toBeVisible()
  await expect(page.getByText('Password wajib diisi')).toBeVisible()
  // Still on login — no navigation, no real API call required
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByTestId('login-submit')).toBeVisible()
})

test('landing public summary KPIs render from mocked API', async ({ page }) => {
  await mockPublicSummary(page)
  await page.goto('/')

  await expect(page.getByTestId('landing-page')).toBeVisible()
  await expect(page.getByTestId('landing-logo')).toBeVisible()
  await expect(page.getByRole('heading', { name: /SIA BUMDes/ })).toBeVisible()

  await expect(page.getByTestId('landing-stats')).toBeVisible()
  await expect(page.getByTestId('stat-pendapatan')).toBeVisible()
  await expect(page.getByTestId('stat-beban')).toBeVisible()
  await expect(page.getByTestId('stat-laba')).toBeVisible()
  await expect(page.getByTestId('stat-pades')).toBeVisible()
  // fmtRp of mocked string amounts — assert visible card labels, not exact currency flake
  await expect(page.getByTestId('stat-pendapatan')).toContainText('Total Pendapatan')
  await expect(page.getByTestId('landing-login-top')).toBeVisible()
})
