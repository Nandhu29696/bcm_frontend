import { expect, test } from '@playwright/test'

import { signIn, VIEWER, type Credentials } from './auth'

/**
 * User administration: an administrator switches a user's second factor off
 * and on, grants a role and an estate, and a non-administrator cannot reach
 * the screen at all.
 */

const ADMIN: Credentials = { email: 'admin@example.com', password: 'Passw0rd!23' }

test('an administrator manages MFA, roles and estates for a user', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users' }).click()
  await expect(page.getByRole('heading', { name: 'User administration' })).toBeVisible()

  await page.getByLabel('Search users').fill('vikram')
  const row = page.getByRole('row').filter({ hasText: VIEWER.email })
  await expect(row).toBeVisible()
  await expect(row).toContainText('On')

  // MFA off, plus a role and an estate, in one save.
  await row.getByRole('button', { name: `Edit ${VIEWER.email}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Multi-factor authentication')).toBeChecked()
  await dialog.getByLabel('Multi-factor authentication').uncheck()
  await dialog.getByLabel('BCM Reviewer', { exact: true }).check()
  await dialog.getByLabel('Chennai Estate', { exact: true }).check()
  await dialog.getByRole('button', { name: /^save$/i }).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).toContainText('Off')
  await expect(row).toContainText('Reviewer')

  // Reopen: the saved state is what the form shows. Then restore.
  await row.getByRole('button', { name: `Edit ${VIEWER.email}` }).click()
  await expect(dialog.getByLabel('Multi-factor authentication')).not.toBeChecked()
  await expect(dialog.getByLabel('BCM Reviewer', { exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Chennai Estate', { exact: true })).toBeChecked()
  await dialog.getByLabel('Multi-factor authentication').check()
  await dialog.getByLabel('BCM Reviewer', { exact: true }).uncheck()
  await dialog.getByLabel('Chennai Estate', { exact: true }).uncheck()
  await dialog.getByRole('button', { name: /^save$/i }).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).toContainText('On')
  await expect(row).not.toContainText('Reviewer')
})

test('a viewer is kept out of user administration', async ({ page }) => {
  await signIn(page, VIEWER)
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users' })).toHaveCount(0)
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'User administration' })).toHaveCount(0)
})

test('an administrator sees the delivery log', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Notification delivery' }).click()
  await expect(page.getByRole('heading', { name: 'Notification delivery' })).toBeVisible()
  await page.getByLabel('Filter by status').selectOption('SENT')
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await expect(page.getByRole('button', { name: /^resend to/i })).toHaveCount(0)
})
