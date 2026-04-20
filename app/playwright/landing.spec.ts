// ============================================================
// E2E: Landing Page
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('page title contains Obscura', async ({ page }) => {
    await expect(page).toHaveTitle(/Obscura/i)
  })

  test('hero headline contains "Private"', async ({ page }) => {
    const hero = page.locator('h1')
    await expect(hero).toContainText('Private')
  })

  test('Launch Terminal button exists and is clickable', async ({ page }) => {
    const btn = page.locator('#cta-launch-terminal')
    await expect(btn).toBeVisible()
    await btn.click()
    // Should navigate to terminal view
    await expect(page.locator('text=Trader Terminal').or(page.locator('.terminal-sidebar'))).toBeVisible()
  })

  test('View Auction Room CTA navigates to auction', async ({ page }) => {
    await page.locator('#cta-view-auction').click()
    await expect(page.locator('h1')).toContainText('Auction Room')
  })

  test('nav bar visible with all 5 items', async ({ page }) => {
    const navItems = ['Overview', 'Terminal', 'Auction Room', 'Compliance', 'Admin']
    for (const label of navItems) {
      await expect(page.locator('nav').getByText(label)).toBeVisible()
    }
  })

  test('devnet badge visible in nav', async ({ page }) => {
    await expect(page.locator('nav').getByText('Devnet')).toBeVisible()
  })

  test('How It Works section contains 5 numbered steps', async ({ page }) => {
    const steps = ['01', '02', '03', '04', '05']
    for (const step of steps) {
      await expect(page.getByText(step)).toBeVisible()
    }
  })

  test('Compliance section visible with correct heading', async ({ page }) => {
    await expect(page.getByText('Private, Not Anonymous')).toBeVisible()
  })

  test('Connect Wallet button in nav when not connected', async ({ page }) => {
    await expect(page.locator('#wallet-connect-btn')).toBeVisible()
  })

  test('live stats strip shows 4 columns', async ({ page }) => {
    const strip = page.locator('[style*="grid-template-columns: repeat(4"]').first()
    await expect(strip).toBeVisible()
  })

  test('MagicBlock architecture badges render', async ({ page }) => {
    await expect(page.getByText('MagicBlock PER')).toBeVisible()
    await expect(page.getByText('Intel TDX TEE')).toBeVisible()
  })
})
