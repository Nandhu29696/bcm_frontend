/**
 * The parts of a plan, in the order a coordinator works through them. The
 * active part lives in the URL (`?part=bia`) so a link lands on the right one.
 *
 *   questionnaire   Basic Questions, MAO, RTO, MBCO, RPO — the section tabs
 *   objectives      the hub: recovery objectives, and BIA / RA / Plan with status
 *   bia             BIA details, dependencies, critical resources, people, network
 *   ra              the risk register
 *   plan            recovery strategy, the BIA lists, network diagram, contacts
 */
export const PARTS = [
  { key: 'questionnaire', label: 'Questionnaire', step: 1 },
  { key: 'objectives', label: 'Recovery objective', step: 2 },
  { key: 'bia', label: 'BIA', step: 3 },
  { key: 'ra', label: 'RA', step: 4 },
  { key: 'plan', label: 'Plan', step: 5 },
] as const

export type PartKey = (typeof PARTS)[number]['key']

export function isPartKey(value: string | null): value is PartKey {
  return PARTS.some((p) => p.key === value)
}

/**
 * Links written before the parts existed addressed the structured sections by
 * name in `?section=`. Keep them landing where they used to.
 */
export const LEGACY_SECTION_PARTS: Record<string, PartKey> = {
  bia: 'bia',
  risks: 'ra',
  strategy: 'plan',
}

/**
 * The BIA section's dependency questions, grouped by what they describe. Any
 * other BIA question is a "BIA detail". Keyed by question code, which the seed
 * fixes and the API exposes (see `seed_questionnaire.ANSWER_SPEC`).
 */
export const DEPENDENCY_GROUPS: Record<string, string> = {
  'BIA-005': 'Internal dependency',
  'BIA-007': 'Internal dependency', // corporate functions and their services
  'BIA-006': 'External dependency',
  'BIA-008': 'External dependency', // vendors and their services
  'BIA-003': 'Subcontractor',
  'BIA-004': 'Subcontractor',
}

export const DEPENDENCY_ORDER = ['Internal dependency', 'External dependency', 'Subcontractor']

export function hours(value: number | null): string | null {
  return value === null ? null : `${value} h`
}

export function percent(value: number | null): string | null {
  return value === null ? null : `${value}%`
}
