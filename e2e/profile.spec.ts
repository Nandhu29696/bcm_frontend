import { expect, test } from '@playwright/test'

import { signIn, VIEWER } from './auth'

/** My profile: details, picture, and the account menu that reaches it. */

// A 2x2 PNG (red), enough for the server to resize into an avatar.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DwHwyZGBgYGBgYGAAoIgMB0t4D5wAAAABJRU5ErkJggg==',
  'base64',
)

test('edit details, upload and remove a picture', async ({ page }) => {
  await signIn(page, VIEWER)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'My profile' }).click()
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible()

  // Details
  const details = page.getByRole('region', { name: 'Details' })
  await details.getByLabel('Job title').fill('IT Support Analyst')
  await details.getByLabel('Phone number').fill('+91 98000 12345')
  await details.getByRole('button', { name: /save details/i }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Details' }).getByLabel('Job title')).toHaveValue('IT Support Analyst')

  // Picture
  const picture = page.getByRole('region', { name: 'Profile picture' })
  await picture.getByLabel('Choose a profile picture').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(picture.getByRole('img', { name: /your profile picture/i })).toBeVisible()
  await expect(picture.getByRole('img', { name: /your profile picture/i })).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  // The top bar shows it too.
  await expect(page.getByRole('button', { name: 'Account menu' }).locator('img')).toBeVisible()
  await picture.getByRole('button', { name: /remove/i }).click()
  await expect(picture.getByLabel('No profile picture')).toBeVisible()

  // Restore the details so the run is repeatable.
  await details.getByLabel('Job title').fill('')
  await details.getByLabel('Phone number').fill('')
  await details.getByRole('button', { name: /save details/i }).click()
  await expect(page.getByRole('status').last()).toContainText('Profile saved')
})

test('access facts are shown, not editable', async ({ page }) => {
  await signIn(page, VIEWER)
  await page.goto('/profile')
  const access = page.getByRole('region', { name: 'Access' })
  await expect(access).toContainText('Viewer')
  await expect(access).toContainText('Two-step code')
  await expect(page.getByRole('region', { name: 'Details' }).getByLabel('Email')).toBeDisabled()
})
