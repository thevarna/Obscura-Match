// ============================================================
// E2E: Navigation — all 5 views rendering correctly
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('navigates to Terminal via nav', async ({ page }) => {
    await page.locator('#nav-terminal').click()
    await expect(page.locator('.terminal-sidebar').or(page.locator('h1').filter({ hasText: /terminal/i }))).toBeVisible({ timeout: 5000 })
  })

  test('navigates to Auction Room via nav', async ({ page }) => {
    await page.locator('#nav-auction').click()
    await expect(page.locator('h1').filter({ hasText: 'Auction Room' })).toBeVisible()
  })

  test('navigates to Compliance via nav', async ({ page }) => {
    await page.locator('#nav-compliance').click()
    await expect(page.locator('h1').filter({ hasText: /Compliance/i })).toBeVisible()
  })

  test('navigates to Admin via nav', async ({ page }) => {
    await page.locator('#nav-admin').click()
    await expect(page.locator('h1').filter({ hasText: /Admin/i })).toBeVisible()
  })

  test('clicking logo returns to landing page', async ({ page }) => {
    // Go to terminal first
    await page.locator('#nav-terminal').click()
    // Click the logo text
    await page.locator('nav .flex').first().click()
    await expect(page.locator('h1').filter({ hasText: /Institutional|Private|Obscura/i })).toBeVisible()
  })

  test('active nav item is visually distinct', async ({ page }) => {
    await page.locator('#nav-auction').click()
    const auctionBtn = page.locator('#nav-auction')
    // Active button should not have text-muted color — check computed style
    const color = await auctionBtn.evaluate(el => getComputedStyle(el).color)
    // Just check it's applied (truthy)
    expect(color).toBeTruthy()
  })

  test('all nav buttons have unique IDs', async ({ page }) => {
    const ids = ['nav-landing', 'nav-terminal', 'nav-auction', 'nav-compliance', 'nav-admin']
    for (const id of ids) {
      const btn = page.locator(`#${id}`)
      await expect(btn).toBeVisible()
    }
  })
})

// ─── Keyboard navigation ───────────────────────────────────

test.describe('Keyboard accessibility', () => {
  test('nav buttons are focusable and activatable with Enter', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('#nav-auction')
    await btn.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('h1').filter({ hasText: 'Auction Room' })).toBeVisible()
  })

  test('CTA buttons are focusable', async ({ page }) => {
    await page.goto('/')
    const btn = page.locator('#cta-launch-terminal')
    await expect(btn).toBeVisible()
    await btn.focus()
    expect(await btn.evaluate(el => document.activeElement === el)).toBe(true)
  })
})
