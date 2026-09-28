import { expect, test, type Page } from '@playwright/test'

/** No real backend — auth and other /api calls return 401. */
async function mockApiUnauthenticated(page: Page) {
  await page.route('**/api/**', async (route) => {
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
