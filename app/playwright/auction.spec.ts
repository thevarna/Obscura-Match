// ============================================================
// E2E: Auction Room — timer, crank monitor, sealed orders,
// MEV explanation, settlement reveal
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Auction Room', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-auction').click()
    await page.waitForLoadState('networkidle')
  })

  test('page heading is "Auction Room"', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Auction Room' })).toBeVisible()
  })

  test('pair descriptor visible', async ({ page }) => {
    await expect(page.getByText('USDC / SOL')).toBeVisible()
  })

  test('OPEN status badge visible on active auction', async ({ page }) => {
    await expect(page.getByText('OPEN')).toBeVisible()
  })

  test('countdown timer renders SVG', async ({ page }) => {
    const svg = page.locator('svg').first()
    await expect(svg).toBeVisible()
  })

  test('countdown "Auction Closes In" text visible', async ({ page }) => {
    await expect(page.getByText('Auction Closes In')).toBeVisible()
  })

  test('Crank Scheduler section exists', async ({ page }) => {
    await expect(page.getByText('Crank Scheduler')).toBeVisible()
  })

  test('crank jobs show Auction Close and Settlement Trigger', async ({ page }) => {
    await expect(page.getByText('Auction Close')).toBeVisible()
    await expect(page.getByText('Settlement Trigger')).toBeVisible()
  })

  test('crank notice says "time-based close and settlement only"', async ({ page }) => {
    await expect(page.getByText(/time-based close and settlement only/i)).toBeVisible()
  })

  test('no public order book notice visible', async ({ page }) => {
    await expect(page.getByText('No Public Order Book')).toBeVisible()
  })

  test('"Why This Eliminates MEV" section present', async ({ page }) => {
    await expect(page.getByText('Why This Eliminates MEV')).toBeVisible()
  })

  test('MEV explanation includes all 4 points', async ({ page }) => {
    const points = ['Sealed Bids', 'Batch Settlement', 'TEE Enforcement', 'Permission Control']
    for (const p of points) {
      await expect(page.getByText(p)).toBeVisible()
    }
  })

  test('auction stats show Sealed Orders and Lot Size', async ({ page }) => {
    await expect(page.getByText('Sealed Orders')).toBeVisible()
    await expect(page.getByText('Lot Size')).toBeVisible()
  })

  test('sealed orders count shows 🔒 Private', async ({ page }) => {
    await expect(page.getByText('🔒 Private')).toBeVisible()
  })

  test('fee row visible in stats', async ({ page }) => {
    await expect(page.getByText('Fee')).toBeVisible()
  })

  test('"Awaiting Settlement" placeholder visible before match', async ({ page }) => {
    await expect(page.getByText('Awaiting Settlement')).toBeVisible()
  })
})
