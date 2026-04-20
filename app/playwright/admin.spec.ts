// ============================================================
// E2E: Admin / Ops View — crank jobs, health panel,
// auction config, architecture reference
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Admin / Ops View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-admin').click()
    await page.waitForLoadState('networkidle')
  })

  test('page heading is "Admin / Ops"', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /Admin/i })).toBeVisible()
  })

  test('Crank Scheduler section visible', async ({ page }) => {
    await expect(page.getByText('Crank Scheduler').first()).toBeVisible()
  })

  test('crank warning about time-based only', async ({ page }) => {
    await expect(page.getByText(/time-based/i)).toBeVisible()
  })

  test('System Health section visible', async ({ page }) => {
    await expect(page.getByText('System Health')).toBeVisible()
  })

  test('health rows include TEE RPC Connection', async ({ page }) => {
    await expect(page.getByText('TEE RPC Connection')).toBeVisible()
  })

  test('health rows include Private Payments API', async ({ page }) => {
    await expect(page.getByText('Private Payments API')).toBeVisible()
  })

  test('devnet badge visible in health panel', async ({ page }) => {
    await expect(page.getByText('Devnet')).toBeVisible()
  })

  test('Auction Configuration section visible', async ({ page }) => {
    await expect(page.getByText('Auction Configuration')).toBeVisible()
  })

  test('auction config shows USDC/SOL pair', async ({ page }) => {
    await expect(page.getByText('USDC / SOL')).toBeVisible()
  })

  test('auction config shows fee in bps', async ({ page }) => {
    await expect(page.getByText(/bps/)).toBeVisible()
  })

  test('Architecture Reference section visible', async ({ page }) => {
    await expect(page.getByText('Architecture Reference')).toBeVisible()
  })

  test('architecture panel shows ACL Program address', async ({ page }) => {
    await expect(page.getByText('ACL Program')).toBeVisible()
  })

  test('architecture panel shows TEE Validator address', async ({ page }) => {
    await expect(page.getByText('TEE Validator')).toBeVisible()
  })

  test('architecture panel shows Payments API endpoint', async ({ page }) => {
    await expect(page.getByText('Payments API')).toBeVisible()
  })

  test('env-configurable badges visible', async ({ page }) => {
    const badges = await page.getByText('env-configurable').count()
    expect(badges).toBeGreaterThanOrEqual(3)
  })

  test('delegation program address mentioned', async ({ page }) => {
    await expect(page.getByText('Delegation Program')).toBeVisible()
  })

  test('crank job types present: Auction Close and Settlement Trigger', async ({ page }) => {
    // Give time for crank state to initialize
    await page.waitForTimeout(100)
    const closeText = page.getByText(/Auction Close/i)
    const settleText = page.getByText(/Settlement Trigger/i)
    await expect(closeText.first()).toBeVisible()
    await expect(settleText.first()).toBeVisible()
  })
})
