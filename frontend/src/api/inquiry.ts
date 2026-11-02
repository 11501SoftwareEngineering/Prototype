import { apiClient } from './client'

// Three-stage contract. These endpoints are implemented by MSW in demo mode;
// production backend integration is tracked in docs/前端三階段串接.md.
export type AgeBand = '13-15' | '16-18' | 'university_plus'
export type ContentLanguage = 'zh-TW' | 'en' | 'es'
export type PublicationStatus = 'draft' | 'published'

export interface InquirySetup {
  age_band: AgeBand
  max_turns: 5 | 10 | 15
  topic: string
  core_question: string
  inquiry_focus: string
  background_info: string
  exclusions: string
  opening_message: string
}

export interface SetupInput {
  age_band: AgeBand
  max_turns: 5 | 10 | 15
  description: string
  source_language: ContentLanguage
}

export interface SetupJob {
  job_id: string
  question_count: number
  questions: { id: string; text: string }[]
  setup: InquirySetup | null
  checks: { field: string; status: 'ready' | 'needs_review'; message: string }[]
}

export interface InquiryDetail {
  topic_id: string
  course_id: string
  version: number
  status: PublicationStatus
  source_language: ContentLanguage
  model_id: string
  setup: InquirySetup
}

export interface EvidenceRef {
  message_id: string
  turn: number
  quote: string
}

export interface ViewpointTimelinePoint {
  turn: number
  question: string
  question_message_id?: string
  answer?: EvidenceRef
  before_summary: string | null
  after_summary: string
  change_type:
    'initial' | 'clarified' | 'revised' | 'maintained' | 'uncertain' | 'unassessed' | 'mixed'
  explanation: string
  attribution: 'explicit' | 'sequence_only' | 'none'
  affected_count?: number
  related_group_ids?: string[]
}

export interface IndividualReport {
  report_id: string
  version: number
  session_id: string
  topic_id: string
  anonymous_id: string
  completed_at: string
  completed_turns: number
  completion_reason: 'max_turns' | 'goal_met_and_consented'
  inquiry_summary: string
  viewpoint_summary?: string
  evidence_status?: 'sufficient' | 'partial' | 'insufficient'
  final_viewpoint: string | null
  viewpoint_status: 'expressed' | 'undetermined'
  reasons: { text: string; evidence: EvidenceRef }[]
  strongest_reason?: { text: string; evidence: EvidenceRef } | null
  tested_challenges?: { challenge: string; response: string | null; evidence?: EvidenceRef }[]
  revision_or_defense?: string
  focus_connection?: string
  viewpoint_timeline?: ViewpointTimelinePoint[]
  other_perspectives: string[]
  open_questions: string[]
  viewpoint_changes: { turn: number; text: string }[]
  limitations: string[]
}

export interface ReportResponse {
  status: 'pending' | 'processing' | 'ready' | 'failed'
  report: IndividualReport | null
}

export interface ReportCollection {
  topic_id: string
  roster_count: number
  completed_count: number
  pending_count: number
  failed_count: number
  reports: IndividualReport[]
}

export interface ViewpointGroup {
  group_id: string
  title: string
  description: string
  report_ids: string[]
  count: number
  percentage: number
}

export interface ClassSummary {
  summary_id: string
  version: number
  status: 'draft' | 'reviewed' | 'published' | 'withdrawn'
  topic_id: string
  overview: string
  viewpoint_summary?: string
  viewpoint_timeline?: ViewpointTimelinePoint[]
  groups: ViewpointGroup[]
  ungrouped_report_ids: string[]
  ungrouped_count: number
  report_count: number
  completed_count: number
  roster_count: number
  generated_at: string
  published_at: string | null
}

export interface SummaryResponse {
  draft: ClassSummary | null
  published: ClassSummary | null
}

export interface ModelOption {
  provider_model_id?: string
  pricing?: {
    input_per_million_usd: number | null
    output_per_million_usd: number | null
    currency: 'USD'
    source: 'demo' | 'openrouter'
    updated_at: string
  }
  id: string
  name: string
  description: string
}

export const inquiryKeys = {
  detail: (id: string) => ['inquiry', id, 'setup'] as const,
  reports: (id: string) => ['inquiry', id, 'reports'] as const,
  report: (id: string) => ['inquiry', 'session', id, 'report'] as const,
  summary: (id: string) => ['inquiry', id, 'summary'] as const,
  published: (id: string) => ['inquiry', id, 'published'] as const,
  models: ['inquiry', 'models'] as const,
}

const enc = encodeURIComponent
export const inquiryApi = {
  async prepare(courseId: string, input: SetupInput) {
    return (await apiClient.post<SetupJob>(`/teacher/courses/${enc(courseId)}/setup-jobs`, input))
      .data
  },
  async clarify(courseId: string, jobId: string, answers: Record<string, string>) {
    return (
      await apiClient.post<SetupJob>(
        `/teacher/courses/${enc(courseId)}/setup-jobs/${enc(jobId)}/answers`,
        { answers },
      )
    ).data
  },
  async refine(courseId: string, jobId: string, setup: InquirySetup, feedback: string) {
    return (
      await apiClient.post<SetupJob>(
        `/teacher/courses/${enc(courseId)}/setup-jobs/${enc(jobId)}/refine`,
        { setup, feedback },
      )
    ).data
  },
  async revise(
    courseId: string,
    setup: InquirySetup,
    feedback: string,
    sourceLanguage: ContentLanguage,
  ) {
    return (
      await apiClient.post<SetupJob>(`/teacher/courses/${enc(courseId)}/setup-revisions`, {
        setup,
        feedback,
        source_language: sourceLanguage,
      })
    ).data
  },
  async refreshOpening(
    courseId: string,
    setup: InquirySetup,
    sourceLanguage: ContentLanguage,
    modelId: string,
  ) {
    return (
      await apiClient.post<{ opening_message: string }>(
        `/teacher/courses/${enc(courseId)}/opening-message`,
        { setup, source_language: sourceLanguage, model_id: modelId },
      )
    ).data
  },
  async getSetup(topicId: string) {
    return (await apiClient.get<InquiryDetail>(`/teacher/topics/${enc(topicId)}/setup`)).data
  },
  async saveSetup(
    courseId: string,
    payload: Omit<InquiryDetail, 'course_id' | 'version'> & { expected_version?: number },
  ) {
    return (
      await apiClient.post<InquiryDetail>(`/teacher/courses/${enc(courseId)}/inquiries`, payload)
    ).data
  },
  async getReports(topicId: string) {
    return (await apiClient.get<ReportCollection>(`/teacher/topics/${enc(topicId)}/reports`)).data
  },
  async getReport(sessionId: string) {
    return (await apiClient.get<ReportResponse>(`/student/sessions/${enc(sessionId)}/report`)).data
  },
  async getSummary(topicId: string) {
    return (await apiClient.get<SummaryResponse>(`/teacher/topics/${enc(topicId)}/summary`)).data
  },
  async generateSummary(topicId: string) {
    return (await apiClient.post<ClassSummary>(`/teacher/topics/${enc(topicId)}/summary`)).data
  },
  async updateSummary(
    topicId: string,
    summary: Pick<ClassSummary, 'version' | 'overview' | 'viewpoint_summary'>,
  ) {
    return (await apiClient.patch<ClassSummary>(`/teacher/topics/${enc(topicId)}/summary`, summary))
      .data
  },
  async reviewSummary(topicId: string, version: number) {
    return (
      await apiClient.post<ClassSummary>(`/teacher/topics/${enc(topicId)}/summary/review`, {
        version,
      })
    ).data
  },
  async publishSummary(topicId: string, version: number) {
    return (
      await apiClient.post<ClassSummary>(`/teacher/topics/${enc(topicId)}/summary/publish`, {
        version,
      })
    ).data
  },
  async withdrawSummary(topicId: string, version: number) {
    return (await apiClient.post(`/teacher/topics/${enc(topicId)}/summary/withdraw`, { version }))
      .data
  },
  async getPublishedSummary(topicId: string) {
    return (
      await apiClient.get<{ summary: ClassSummary | null }>(
        `/student/topics/${enc(topicId)}/summary`,
      )
    ).data
  },
  async endSession(sessionId: string, action: 'complete' | 'continue' | 'abandon') {
    return (await apiClient.post(`/student/sessions/${enc(sessionId)}/end`, { action })).data
  },
  async getModels() {
    return (await apiClient.get<ModelOption[]>('/teacher/inquiry-models')).data
  },
}
