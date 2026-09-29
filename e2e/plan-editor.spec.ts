import { expect, test, type Page } from '@playwright/test'

import { COORDINATOR, VIEWER, signIn } from './auth'

/**
 * Journey step 5 through a real browser (Phase 4.9): section tabs, conditional
 * branches, autosave, completion badges, comments, read-only rendering.
 *
 * Uses 65-DEMO01, whose current version is Work in Progress with Arun assigned
 * as coordinator (copied forward from v1 by the Phase 3 suite, or seeded).
 */

const COST_CODE = '65-DEMO01'
const APPROVED_COST_CODE = '65-DEMO07'

async function openEditor(page: Page, code: string) {
  await page.getByRole('link', { name: /Bangalore Estate/ }).click()
  await page.getByLabel(/filter by cost code/i).fill(code)
  await expect(page.getByRole('link', { name: code, exact: true })).toBeVisible()
  // ...and the filter is debounced, so first wait for it to reach the URL —
  // otherwise "not updating" is checked before the fetch has even started.
  await expect(page).toHaveURL(/cost_code=/)
  await expect(page.getByText('Updating')).toHaveCount(0)
  await page.getByRole('link', { name: code, exact: true }).click()
  await page.getByRole('region', { name: /current version/i }).getByRole('link', { name: /open plan|view plan/i }).click()
  await expect(page.getByRole('tablist', { name: /sections/i })).toBeVisible()
}

/**
 * A questionnaire section tab. Its accessible name is the section name followed
 * by the completion badge ("RTO 1 left" or "RTO Done").
 */
function sectionTab(page: Page, name: string) {
  return page
    .getByRole('tablist', { name: /sections/i })
    .getByRole('tab', { name: new RegExp(`^${name} ([0-9]+%|[0-9]+ left|Done)$`) })
}

/** A part of the plan: Questionnaire, Summary, BIA, RA, Plan. */
function part(page: Page, name: string) {
  return page.getByRole('tablist', { name: 'Parts' }).getByRole('tab', { name, exact: true })
}

function question(page: Page, text: RegExp) {
  return page.getByRole('article').filter({ hasText: text })
}

test.describe('plan editor', () => {
  test.setTimeout(60_000)

  test('renders the questionnaire tabs and the five parts', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)

    // The questionnaire tabs: the contractual numbers together. BIA is not a
    // tab — its questions are answered in the BIA part.
    const tabs = page.getByRole('tablist', { name: /sections/i }).getByRole('tab')
    await expect(tabs).toHaveText([/Basic Questions/, /MAO/, /RTO/, /MBCO/, /RPO/])
    await expect(page.getByRole('tablist', { name: 'Parts' }).getByRole('tab')).toHaveText([
      /Questionnaire/, /Summary/, /BIA/, /RA/, /Plan/,
    ])
    await expect(page.getByText(/All changes saved/)).toBeVisible()
  })

  test('the summary hub reads the answers and opens the parts', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)

    // A known RTO, so the hub has something to show.
    await sectionTab(page, 'RTO').click()
    const rto = question(page, /What is the RTO/)
    const current = Number(await rto.getByRole('spinbutton').inputValue()) || 0
    const hours = String(current === 6 ? 10 : 6)
    await rto.getByRole('spinbutton').fill(hours)
    await expect(rto.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })

    await part(page, 'Summary').click()
    const objectives = page.getByRole('region', { name: 'Recovery objectives' })
    await expect(objectives).toContainText(`${hours} h`)
    const parts = page.getByRole('list', { name: 'Plan parts' })
    await expect(parts.getByRole('listitem')).toHaveText([/BIA/, /RA/, /Plan/])
    await expect(parts.getByRole('listitem').first()).toContainText(/Not Started|In Progress|Completed/)

    // A card opens its part, and the URL remembers it.
    await parts.getByRole('listitem').filter({ hasText: /^RA/ }).click()
    await expect(page.getByRole('region', { name: 'Risk register' })).toBeVisible()
    await expect(page).toHaveURL(/part=ra/)
  })

  test('the BIA part lists the people behind the cost code', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'BIA').click()

    await expect(page.getByRole('heading', { name: 'BIA details' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dependencies' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Internal dependency' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'External dependency' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Subcontractor' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Employees on this cost code' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'BU leads' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Coordinators' })).toContainText(/Arun/)
    await expect(page.getByRole('region', { name: 'Project network' })).toBeVisible()
  })

  test('a branch is disabled when its dependency is not selected', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)

    const q1 = question(page, /Dedicated Client Offshore/)
    const ifYes = question(page, /If Yes to Q1/)
    const ifNo = question(page, /If the response to the Q1 is "No"/)

    await q1.getByRole('radio', { name: 'No' }).check()
    await expect(ifNo).toBeVisible()
    await expect(ifYes).toBeVisible()
    await expect(ifYes.getByRole('radio', { name: 'Yes' })).toBeDisabled()

    await q1.getByRole('radio', { name: 'Yes' }).check()
    await expect(ifYes).toBeVisible()
    await expect(ifNo).toBeVisible()
    await expect(ifNo.getByRole('radio', { name: 'Yes' })).toBeDisabled()
    await expect(q1.getByText(/^Saved$/)).toBeVisible()
  })

  test('answers autosave and section badges advance', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)

    // Basic Questions: Q1 = No hides the optional branch; Q4 = No completes the
    // section (a Yes would also need the penalty clause uploaded — see below).
    await question(page, /Dedicated Client Offshore/).getByRole('radio', { name: 'No' }).check()
    await question(page, /penalties for BCP non-compliance/).getByRole('radio', { name: 'No' }).check()
    await expect(sectionTab(page, 'Basic Questions')).toContainText('Done')

    // RTO: a typed number saves after the debounce. Always a value that differs
    // from what is stored, or React sees no change and nothing is saved.
    await sectionTab(page, 'RTO').click()
    const rto = question(page, /What is the RTO/)
    const current = Number(await rto.getByRole('spinbutton').inputValue()) || 0
    const hours = String(current === 8 ? 12 : 8)
    await rto.getByRole('spinbutton').fill(hours)
    await expect(rto.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })
    await expect(sectionTab(page, 'RTO')).toContainText('Done')
    await expect(page.getByText(/All changes saved/)).toBeVisible()

    // Survives a reload: the tab and the answer come back.
    await page.reload()
    await expect(page.getByRole('tablist', { name: /sections/i })).toBeVisible()
    await expect(sectionTab(page, 'RTO')).toContainText('Done')
    await sectionTab(page, 'RTO').click()
    await expect(question(page, /What is the RTO/).getByRole('spinbutton')).toHaveValue(hours)
  })

  test('a Yes on a penalty clause asks for evidence before the section completes', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)

    await question(page, /Dedicated Client Offshore/).getByRole('radio', { name: 'No' }).check()
    const penalties = question(page, /penalties for BCP non-compliance/)
    // No first, so the Yes is a change that saves whatever an earlier run left.
    await penalties.getByRole('radio', { name: 'No' }).check()
    await penalties.getByRole('radio', { name: 'Yes' }).check()
    await expect(penalties.getByText(/^Saved$/)).toBeVisible()

    // Start clean: an earlier run (the review cycle) may have left a file.
    const evidence = penalties.getByRole('region', { name: /evidence for BASIC-004/i })
    while ((await evidence.getByRole('button', { name: /remove/i }).count()) > 0) {
      const before = await evidence.getByRole('listitem').count()
      await evidence.getByRole('button', { name: /remove/i }).first().click()
      await expect(evidence.getByRole('listitem')).toHaveCount(before - 1)
    }
    await expect(evidence).toContainText(/upload the supporting document/i)
    await expect(sectionTab(page, 'Basic Questions')).not.toContainText('Done')

    await evidence.getByLabel(/choose evidence/i).setInputFiles({
      name: 'e2e-penalty-clause.pdf',
      mimeType: 'application/pdf',
      // Unique bytes: the store is content-addressed and identical bytes would
      // resolve to an earlier upload under its own name.
      buffer: Buffer.from(`%PDF-1.4 e2e ${Date.now()}`),
    })
    await expect(evidence).toContainText('e2e-penalty-clause.pdf')
    await expect(sectionTab(page, 'Basic Questions')).toContainText('Done')

    // Removing the file reopens the section; a No needs no evidence at all.
    await evidence.getByRole('button', { name: /remove/i }).click()
    await expect(evidence).not.toContainText('e2e-penalty-clause.pdf')
    await expect(sectionTab(page, 'Basic Questions')).not.toContainText('Done')
    await penalties.getByRole('radio', { name: 'No' }).check()
    await expect(penalties.getByRole('region', { name: /evidence/i })).toHaveCount(0)
    await expect(sectionTab(page, 'Basic Questions')).toContainText('Done')
  })

  test('the contractual numbers offer an optional evidence upload', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    for (const tab of ['MAO', 'RTO', 'MBCO'] as const) {
      await sectionTab(page, tab).click()
      const region = page.getByRole('region', { name: new RegExp(`evidence for ${tab}-001`, 'i') })
      await expect(region).toContainText('optional')
      await expect(region.getByRole('button', { name: /upload evidence/i })).toBeVisible()
    }
  })

  test('a Yes on a dependency question opens a who-and-service list', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'BIA').click()

    const corp = question(page, /dedicated Corp Function support/)
    const list = question(page, /Which corporate functions/)
    await corp.getByRole('radio', { name: 'No' }).check()
    await expect(list).toHaveCount(0)

    await corp.getByRole('radio', { name: 'Yes' }).check()
    await expect(list).toBeVisible()
    // It sits under the Internal dependency heading, with its question.
    await expect(page.getByRole('heading', { name: 'Internal dependency' })).toContainText('2')
    await list.getByRole('button', { name: /add (a|another) row/i }).click()
    await list.getByRole('combobox', { name: 'Corporate function' }).last().selectOption({ index: 1 })
    await list.getByRole('textbox', { name: 'Service provided' }).last().fill('E2E payroll')
    await expect(list.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })
    await list.getByRole('button', { name: /remove row/i }).last().click()
    await expect(list.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })

    const vendors = question(page, /third party support for BAU/)
    await vendors.getByRole('radio', { name: 'Yes' }).check()
    const vendorList = question(page, /Which vendors/)
    await expect(vendorList).toBeVisible()
    await expect(vendorList.getByRole('button', { name: /add (a|another) row/i })).toBeVisible()

    // Tidy up so the run is repeatable.
    await corp.getByRole('radio', { name: 'No' }).check()
    await vendors.getByRole('radio', { name: 'No' }).check()
    await expect(list).toHaveCount(0)
  })

  test('the subcontractor sub-form appears on Yes and takes rows', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'BIA').click()

    const outsourced = question(page, /outsourced or Sub contracted/)
    const subform = question(page, /Update below fields/)
    await outsourced.getByRole('radio', { name: 'No' }).check()
    await expect(subform).toHaveCount(0)

    await outsourced.getByRole('radio', { name: 'Yes' }).check()
    await expect(subform).toBeVisible()
    // Rows from an earlier run survive a No (hidden answers are kept, so
    // flipping back to Yes restores them). Work on the row added now.
    await subform.getByRole('button', { name: /add (a|another) row/i }).click()
    await subform.getByRole('combobox', { name: 'Subcontractor' }).last().selectOption({ index: 1 })
    await subform.getByRole('textbox', { name: 'Service provided' }).last().fill('Catering')
    await subform.getByRole('combobox', { name: 'Criticality' }).last().selectOption('HIGH')
    await expect(subform.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })
    // Remove the row we added, leaving the answer as we found it.
    await subform.getByRole('button', { name: /remove row/i }).last().click()
    await expect(subform.getByText(/^Saved$/)).toBeVisible({ timeout: 5_000 })

    // Tidy up so the run is repeatable.
    await outsourced.getByRole('radio', { name: 'No' }).check()
  })

  test('comments thread per question', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await sectionTab(page, 'RTO').click()

    const rto = question(page, /What is the RTO/)
    const before = Number((await rto.getByRole('button', { name: /comments on/i }).innerText()).replace(/\D/g, ''))
    await rto.getByRole('button', { name: /comments on/i }).click()
    const dialog = page.getByRole('dialog', { name: /comments on RTO-001/i })
    await dialog.getByRole('textbox', { name: /new comment/i }).fill('Is 8 hours realistic for this client?')
    await dialog.getByRole('button', { name: /post comment/i }).click()
    await expect(dialog).toContainText('Is 8 hours realistic')
    await page.keyboard.press('Escape')
    await expect(rto.getByRole('button', { name: /comments on/i })).toContainText(String(before + 1))
  })

  test('a viewer sees the plan read-only', async ({ page }) => {
    await signIn(page, VIEWER)
    await openEditor(page, COST_CODE)

    await expect(page.getByText(/Read-only: you are not an author/)).toBeVisible()
    await expect(question(page, /Dedicated Client Offshore/).getByRole('radio', { name: 'Yes' })).toBeDisabled()
    await expect(page.getByText(/All changes saved/)).toHaveCount(0)
  })

  test('an approved version is read-only even for its coordinator', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, APPROVED_COST_CODE)

    await expect(page.getByText(/Read-only: this version is closed/)).toBeVisible()
    await expect(question(page, /Dedicated Client Offshore/).getByRole('radio', { name: 'Yes' })).toBeDisabled()
  })
})
