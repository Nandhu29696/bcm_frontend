/** Journey step 5, the plan editor. Shapes mirror `apps/questionnaire/services.py`. */

import type { BcpStatus } from '@/features/estates/types'

export type AnswerType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT' | 'NUMBER' | 'DATE' | 'SUBFORM'
export type DependencyOperator = 'EQUALS' | 'NOT_EQUALS' | 'IN'
export type SectionStatusValue = 'Not Started' | 'In Progress' | 'Completed'
export type AnswerContext =
  | 'BCP'
  | 'BIA'
  | 'INTERNAL_DEPENDENCY'
  | 'EXTERNAL_DEPENDENCY'
  | 'SUBCONTRACTOR'

export interface Option {
  code: string
  label: string
}

export interface DependencyRule {
  question_id: number
  operator: DependencyOperator
  value: string
}

export interface SubformField {
  name: string
  label: string
  type: 'text' | 'lookup' | 'choice'
  required: boolean
  options?: Option[]
}

/** The stored answer. Validated server-side per answer_type (AD-5). */
export type AnswerJson =
  | { value: string; detail?: string[] }
  | { value: string[] }
  | { value: number }
  | { rows: Record<string, string>[] }

export interface EditorQuestion {
  question_id: number
  question_code: string
  question_text: string
  question_description: string
  answer_type: AnswerType
  required: boolean
  visible: boolean
  depends_on: DependencyRule | null
  options: Option[]
  detail_options: Option[]
  subform_schema: SubformField[]
  answer: AnswerJson | null
  answered_by: string | null
  answered_at: string | null
  comment_count: number
  evidence: QuestionEvidence
}

/**
 * A question's evidence rule and files. `offered` questions show an upload;
 * with `when_value` only for that answer (an option code such as YES). A
 * `required` file is part of what counts as answered — the section stays
 * short of complete without it.
 */
export interface QuestionEvidence {
  offered: boolean
  when_value: string | null
  required: boolean
  files: Attachment[]
}

export interface EvidenceResult {
  question_id: number
  files: Attachment[]
  sections: SectionProgress[]
}

/**
 * Where a section is shown: on the questionnaire tabs, or inside the plan's
 * BIA part (the BIA section's questions are answered there, not on a tab).
 */
export type SectionGroup = 'questionnaire' | 'bia'

export interface EditorSection {
  section_id: number
  section_name: string
  group: SectionGroup
  status: SectionStatusValue
  percent: number
  required_visible: number
  required_answered: number
  questions: EditorQuestion[]
}

export interface SectionProgress {
  section_id: number
  status: SectionStatusValue
  percent: number
  required_visible: number
  required_answered: number
}

export interface Questionnaire {
  plan_version_id: number
  context: AnswerContext
  contexts: AnswerContext[]
  editable: boolean
  can_author: boolean
  status: BcpStatus
  sections: EditorSection[]
}

export interface SaveResult {
  question_id: number
  answer: AnswerJson
  answered_by: string
  answered_at: string
  sections: SectionProgress[]
}

export interface QuestionCommentEntry {
  question_comment_id: number
  question_id: number
  comment: string
  author_name: string
  created_at: string
}

// --------------------------------------------------------------------------- //
// The overview: recovery objectives, BIA / RA / Plan statuses, people.
// Shapes mirror `apps/plans/overview.py`.
// --------------------------------------------------------------------------- //

export interface RecoveryObjectives {
  rto_hours: number | null
  mbco_percent: number | null
  rpo_in_contract: string | null
  rpo_hours: number | null
  mao_hours: number | null
}

export interface StageStatus {
  status: SectionStatusValue
}

export interface OverviewEmployee {
  employee_id: number
  employee_number: string
  full_name: string
  email: string
  designation: string
  bu_lead: string
}

export interface OverviewBuLead {
  bu_lead_id: number
  lead_name: string
  email: string
  /** The cost code's own lead; the others are leads its employees report to. */
  primary: boolean
}

export interface OverviewCoordinator {
  coordinator_assignment_id: number
  employee_id: number
  full_name: string
  email: string
  coordinator_type: string
}

export interface PlanOverview {
  plan_version_id: number
  objectives: RecoveryObjectives
  stages: {
    bia: StageStatus & {
      required_visible: number
      required_answered: number
      critical_resources: number
      network_requirements: number
    }
    ra: StageStatus & { risks: number; unrated: number }
    plan: StageStatus & { strategies: number; network_diagrams: number }
  }
  people: {
    headcount: number
    mbco_percent: number | null
    mbco_required: number | null
    employees: OverviewEmployee[]
    bu_leads: OverviewBuLead[]
    coordinators: OverviewCoordinator[]
  }
}

export type AttachmentType = 'NETWORK_DIAGRAM'

export interface Attachment {
  entity_document_id: number
  document_type: AttachmentType
  file_name: string
  mime_type: string
  file_size_bytes: number
  uploaded_at: string
  uploaded_by: string
}
