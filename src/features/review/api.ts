import { api } from '@/api/client'
import type { PlanVersion } from '@/features/plans/types'

/** Phase 6/7: transitions, the review queue, documents and exemptions. */

export interface IncompleteSection {
  section_id: number
  section_name: string
  status: string
  required_answered: number
  required_visible: number
}

export interface Readiness {
  can_submit: boolean
  can_review: boolean
  /** May decide an exemption on this version (BU lead of its cost code, or admin). */
  is_approver: boolean
  is_author: boolean
  incomplete_sections: IncompleteSection[]
}

export interface QueueRow extends PlanVersion {
  estate_name: string
  process_name: string
  bu_lead_name: string
  submitted_at: string
  can_review: boolean
}

export interface GeneratedDocument {
  entity_document_id: number
  document_type: string
  format: 'docx' | 'pdf'
  file_name: string
  mime_type: string
  file_size_bytes: number
  checksum_sha256: string
  generated_at: string
  template: string
}

export type ExemptionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Rework'

export interface ExemptionComment {
  exemption_comment_id: number
  comment_type: 'APPROVAL' | 'REWORK' | 'GENERAL'
  comment: string
  status: string
  author_name: string
  created_at: string
}

export interface Exemption {
  exemption_id: number
  plan_version_id: number
  status: ExemptionStatus
  reason: string
  answer_1: string
  answer_2: string
  answer_3: string
  requested_by_name: string
  created_at: string
  updated_at: string
  comments: ExemptionComment[]
}

const v = (id: number) => `/plan-versions/${id}`

export const reviewApi = {
  readiness: async (versionId: number): Promise<Readiness> => (await api.get(`${v(versionId)}/readiness/`)).data,
  submit: async (versionId: number, comments: string): Promise<PlanVersion> =>
    (await api.post(`${v(versionId)}/submit/`, { comments })).data,
  approve: async (versionId: number, comments: string): Promise<PlanVersion> =>
    (await api.post(`${v(versionId)}/approve/`, { comments })).data,
  rework: async (versionId: number, comments: string): Promise<PlanVersion> =>
    (await api.post(`${v(versionId)}/rework/`, { comments })).data,
  queue: async (): Promise<QueueRow[]> => (await api.get('/review-queue/')).data,

  documents: async (versionId: number): Promise<GeneratedDocument[]> =>
    (await api.get(`${v(versionId)}/documents/`)).data,
  regenerate: async (versionId: number): Promise<GeneratedDocument[]> =>
    (await api.post(`${v(versionId)}/documents/generate/`)).data,
  downloadLink: async (entityDocumentId: number): Promise<{ url: string; expires_in: number; file_name: string }> =>
    (await api.get(`/documents/${entityDocumentId}/link/`)).data,

  exemptions: async (versionId: number): Promise<Exemption[]> => (await api.get(`${v(versionId)}/exemptions/`)).data,
  requestExemption: async (
    versionId: number,
    payload: { reason: string; answer_1?: string; answer_2?: string; answer_3?: string },
  ): Promise<Exemption> => (await api.post(`${v(versionId)}/exemptions/`, payload)).data,
  decideExemption: async (
    exemptionId: number,
    decision: 'approve' | 'reject' | 'rework',
    comment: string,
  ): Promise<Exemption> => (await api.post(`/exemptions/${exemptionId}/${decision}/`, { comment })).data,
  resubmitExemption: async (exemptionId: number, reason: string): Promise<Exemption> =>
    (await api.post(`/exemptions/${exemptionId}/resubmit/`, { reason })).data,
}

export const reviewKeys = {
  readiness: (id: number) => ['plan-versions', id, 'readiness'] as const,
  queue: ['review-queue'] as const,
  documents: (id: number) => ['plan-versions', id, 'documents'] as const,
  exemptions: (id: number) => ['plan-versions', id, 'exemptions'] as const,
}
