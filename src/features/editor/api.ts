import { api } from '@/api/client'

import type {
  AnswerContext,
  AnswerJson,
  Attachment,
  AttachmentType,
  EvidenceResult,
  PlanOverview,
  QuestionCommentEntry,
  Questionnaire,
  SaveResult,
} from './types'

export const editorApi = {
  async questionnaire(versionId: number, context: AnswerContext): Promise<Questionnaire> {
    const { data } = await api.get<Questionnaire>(
      `/plan-versions/${versionId}/questionnaire/`,
      { params: { context } },
    )
    return data
  },

  async saveAnswer(
    versionId: number,
    questionId: number,
    context: AnswerContext,
    answer: AnswerJson,
  ): Promise<SaveResult> {
    const { data } = await api.put<SaveResult>(
      `/plan-versions/${versionId}/answers/${questionId}/`,
      { answer },
      { params: { context } },
    )
    return data
  },

  async clearAnswer(
    versionId: number,
    questionId: number,
    context: AnswerContext,
  ): Promise<Pick<SaveResult, 'sections'>> {
    const { data } = await api.delete(`/plan-versions/${versionId}/answers/${questionId}/`, {
      params: { context },
    })
    return data
  },

  async comments(versionId: number, questionId: number): Promise<QuestionCommentEntry[]> {
    const { data } = await api.get(
      `/plan-versions/${versionId}/questions/${questionId}/comments/`,
    )
    return data
  },

  async addComment(
    versionId: number,
    questionId: number,
    comment: string,
  ): Promise<QuestionCommentEntry> {
    const { data } = await api.post(
      `/plan-versions/${versionId}/questions/${questionId}/comments/`,
      { comment },
    )
    return data
  },

  async overview(versionId: number): Promise<PlanOverview> {
    const { data } = await api.get<PlanOverview>(`/plan-versions/${versionId}/overview/`)
    return data
  },

  async attachments(versionId: number, type: AttachmentType): Promise<Attachment[]> {
    const { data } = await api.get<Attachment[]>(`/plan-versions/${versionId}/attachments/`, {
      params: { type },
    })
    return data
  },

  async upload(versionId: number, type: AttachmentType, file: File): Promise<Attachment> {
    const body = new FormData()
    body.append('type', type)
    body.append('file', file)
    const { data } = await api.post<Attachment>(`/plan-versions/${versionId}/attachments/`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async detach(versionId: number, entityDocumentId: number): Promise<void> {
    await api.delete(`/plan-versions/${versionId}/attachments/${entityDocumentId}/`)
  },

  async uploadEvidence(versionId: number, questionId: number, file: File): Promise<EvidenceResult> {
    const body = new FormData()
    body.append('file', file)
    const { data } = await api.post<EvidenceResult>(
      `/plan-versions/${versionId}/questions/${questionId}/evidence/`,
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  },

  async removeEvidence(
    versionId: number,
    questionId: number,
    entityDocumentId: number,
  ): Promise<EvidenceResult> {
    const { data } = await api.delete<EvidenceResult>(
      `/plan-versions/${versionId}/questions/${questionId}/evidence/${entityDocumentId}/`,
    )
    return data
  },
}

export const editorKeys = {
  questionnaire: (versionId: number, context: AnswerContext) =>
    ['plan-versions', versionId, 'questionnaire', context] as const,
  comments: (versionId: number, questionId: number) =>
    ['plan-versions', versionId, 'comments', questionId] as const,
  overview: (versionId: number) => ['plan-versions', versionId, 'overview'] as const,
  attachments: (versionId: number, type: AttachmentType) =>
    ['plan-versions', versionId, 'attachments', type] as const,
}
