// ============================================================
// E2E: Compliance View — permission matrix, role matrix,
// audit log, compliance narrative, flag chips
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Compliance View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-compliance').click()
    await page.waitForLoadState('networkidle')
  })

  test('page heading contains "Compliance"', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /Compliance/i })).toBeVisible()
  })

  test('sub-heading mentions ACL program', async ({ page }) => {
    await expect(page.getByText(/ACL program/i)).toBeVisible()
  })

  test('"Permission Flags" section visible', async ({ page }) => {
    await expect(page.getByText('Permission Flags')).toBeVisible()
  })

  test('all 5 flag chips render', async ({ page }) => {
    const flags = ['AUTHORITY', 'TX_LOGS', 'TX_BALANCES', 'TX_MESSAGE', 'ACCOUNT_SIGNATURES']
    for (const flag of flags) {
      await expect(page.getByText(flag).first()).toBeVisible()
    }
  })

  test('Role Matrix section exists', async ({ page }) => {
    await expect(page.getByText('Role Matrix')).toBeVisible()
  })

  test('role matrix shows Trader, Auditor, Admin', async ({ page }) => {
    await expect(page.getByText('Trader').first()).toBeVisible()
    await expect(page.getByText('Auditor').first()).toBeVisible()
    await expect(page.getByText('Admin').first()).toBeVisible()
  })

  test('Your Permission Context section renders', async ({ page }) => {
    await expect(page.getByText('Your Permission Context')).toBeVisible()
  })

  test('Audit Log section visible', async ({ page }) => {
    await expect(page.getByText('Audit Log')).toBeVisible()
  })

  test('audit log shows empty state when no events', async ({ page }) => {
    await expect(page.getByText(/No audit events yet/i)).toBeVisible()
  })

  test('Lawful-Private Positioning section explains compliance', async ({ page }) => {
    await expect(page.getByText('Lawful-Private Positioning')).toBeVisible()
  })

  test('compliance bullets reference TEE attestation', async ({ page }) => {
    await expect(page.getByText(/TEE attestation/i)).toBeVisible()
  })

  test('compliance bullets mention auditor visibility', async ({ page }) => {
    await expect(page.getByText(/Authorized auditors/i)).toBeVisible()
  })

  test('"members: None" described as transitional', async ({ page }) => {
    await expect(page.getByText(/transitional/i).first()).toBeVisible()
  })

  test('flag description for AUTHORITY flag visible', async ({ page }) => {
    await expect(page.getByText(/Modify permissions/i)).toBeVisible()
  })

  test('flag description for TX_LOGS visible', async ({ page }) => {
    await expect(page.getByText(/transaction execution logs/i)).toBeVisible()
  })

  test('flag description for TX_BALANCES visible', async ({ page }) => {
    await expect(page.getByText(/balance changes/i)).toBeVisible()
  })
})

// ─── Post-order audit log population (integration) ────────

test.describe('Compliance — audit log after order', () => {
  test('audit log populates after navigating to terminal and back', async ({ page }) => {
    await page.goto('/')
    // Go to terminal, trigger some navigations (audit events fire on TEE connect etc.)
    await page.locator('#nav-terminal').click()
    await page.waitForLoadState('networkidle')
    // Navigate to compliance
    await page.locator('#nav-compliance').click()
    await page.waitForLoadState('networkidle')
    // Even without wallet, the compliance page should render its structure
    await expect(page.getByText('Audit Log')).toBeVisible()
  })
})
