// ============================================================
// E2E: Trader Terminal — order form, deposit, withdraw,
// TEE connect banner, tab switching, form validation
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Trader Terminal — UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-terminal').click()
    await page.waitForLoadState('networkidle')
  })

  test('Authorize PER button visible when TEE disconnected', async ({ page }) => {
    const teeBtn = page.locator('#tee-connect-btn')
    await expect(teeBtn).toBeVisible()
    await expect(teeBtn).toContainText(/Authorize PER/i)
  })

  test('order form tab is active by default', async ({ page }) => {
    // Order size input should be visible
    await expect(page.locator('#order-size')).toBeVisible()
  })

  test('switching to Deposit tab shows deposit input', async ({ page }) => {
    await page.getByText('⬇ Deposit').click()
    await expect(page.locator('#deposit-amount')).toBeVisible()
  })

  test('switching to Withdraw tab shows withdraw input', async ({ page }) => {
    await page.getByText('⬆ Withdraw').click()
    await expect(page.locator('#withdraw-amount')).toBeVisible()
  })

  test('BUY / SELL side toggle switches sides', async ({ page }) => {
    const sellBtn = page.locator('.side-toggle__btn--sell').first()
    const buyBtn  = page.locator('.side-toggle__btn--buy').first()
    await sellBtn.click()
    await expect(sellBtn).toHaveClass(/active/)
    await buyBtn.click()
    await expect(buyBtn).toHaveClass(/active/)
  })

  test('form shows error when submitting empty order without wallet', async ({ page }) => {
    await page.locator('#submit-order-btn').click()
    // Should show an error about connecting wallet
    await expect(page.locator('.form-error').or(page.getByText(/connect wallet/i))).toBeVisible()
  })

  test('deposit button disabled without wallet', async ({ page }) => {
    await page.getByText('⬇ Deposit').click()
    const depositBtn = page.locator('#deposit-btn')
    await expect(depositBtn).toBeDisabled()
  })

  test('withdraw button disabled without wallet', async ({ page }) => {
    await page.getByText('⬆ Withdraw').click()
    const withdrawBtn = page.locator('#withdraw-btn')
    await expect(withdrawBtn).toBeDisabled()
  })

  test('submit order button disabled without wallet', async ({ page }) => {
    await expect(page.locator('#submit-order-btn')).toBeDisabled()
  })

  test('sidebar shows USDC/SOL pair', async ({ page }) => {
    await expect(page.locator('.terminal-sidebar').getByText('USDC / SOL')).toBeVisible()
  })

  test('sidebar shows auction ID', async ({ page }) => {
    await expect(page.locator('.terminal-sidebar').getByText(/AUCTION-/)).toBeVisible()
  })

  test('sidebar shows auction status badge OPEN', async ({ page }) => {
    await expect(page.locator('.terminal-sidebar').getByText('OPEN')).toBeVisible()
  })

  test('sealed orders count shows 🔒 private indicator', async ({ page }) => {
    await expect(page.locator('.terminal-sidebar').getByText(/🔒/)).toBeVisible()
  })

  test('architecture panel shows TEE validator address', async ({ page }) => {
    const archPanel = page.locator('.terminal-right').or(page.getByText(/TEE Validator/))
    await expect(archPanel.first()).toBeVisible()
  })

  test('expiry dropdown has 4 options', async ({ page }) => {
    const options = await page.locator('#order-expiry option').count()
    expect(options).toBe(4)
  })

  test('private label on sealed bid notice visible', async ({ page }) => {
    await expect(page.getByText(/sealed inside the Private Ephemeral Rollup/i)).toBeVisible()
  })
})

// ─── Form validation (no wallet) ──────────────────────────

test.describe('Trader Terminal — Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-terminal').click()
    await page.waitForLoadState('networkidle')
  })

  test('order size input accepts only numbers', async ({ page }) => {
    const input = page.locator('#order-size')
    await input.fill('abc')
    const val = await input.inputValue()
    // Browser sanitizes non-numeric for type=number
    expect(val).toBe('')
  })

  test('limit price input accepts decimals', async ({ page }) => {
    const input = page.locator('#order-limit')
    await input.fill('0.0044')
    expect(await input.inputValue()).toBe('0.0044')
  })

  test('deposit input accepts integers', async ({ page }) => {
    await page.getByText('⬇ Deposit').click()
    const input = page.locator('#deposit-amount')
    await input.fill('5000')
    expect(await input.inputValue()).toBe('5000')
  })
})
