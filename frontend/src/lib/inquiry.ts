import type { IndividualReport, InquirySetup, ViewpointGroup } from '@/api/inquiry'

export const setupTextFields = [
  'topic',
  'core_question',
  'inquiry_focus',
  'background_info',
  'exclusions',
  'opening_message',
] as const
export type SetupTextField = (typeof setupTextFields)[number]

export function validateSetup(setup: InquirySetup): boolean {
  return (
    ['13-15', '16-18', 'university_plus'].includes(setup.age_band) &&
    [5, 10, 15].includes(setup.max_turns) &&
    setupTextFields.every((key) => setup[key].trim().length > 0)
  )
}

export const textLength = (value: string) => Array.from(value.trim()).length

export function countGroups(
  groups: Pick<ViewpointGroup, 'group_id' | 'title' | 'description' | 'report_ids'>[],
  reportIds: string[],
  ungrouped: string[],
): ViewpointGroup[] {
  const allowed = new Set(reportIds)
  const seen = new Set<string>()
  for (const id of [...groups.flatMap((group) => group.report_ids), ...ungrouped]) {
    if (!allowed.has(id) || seen.has(id)) throw new Error('Invalid or duplicate report membership')
    seen.add(id)
  }
  if (seen.size !== allowed.size || allowed.size !== reportIds.length)
    throw new Error('Incomplete report membership')
  return groups.map((group) => ({
    ...group,
    count: group.report_ids.length,
    percentage: allowed.size ? Math.round((group.report_ids.length / allowed.size) * 1000) / 10 : 0,
  }))
}

// Demo-only grouping of supplied report text, without preset conclusion categories.
// Production must return semantically reviewed groups through the API contract.
export function groupDemoReports(reports: IndividualReport[]) {
  const groups: {
    group_id: string
    title: string
    description: string
    report_ids: string[]
    tokens: Set<string>
  }[] = []
  const ungrouped: string[] = []
  const tokens = (text: string) => {
    const clean = text.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
    return new Set(
      Array.from({ length: Math.max(0, clean.length - 1) }, (_, i) => clean.slice(i, i + 2)),
    )
  }
  for (const report of reports) {
    if (!report.final_viewpoint || report.viewpoint_status === 'undetermined') {
      ungrouped.push(report.report_id)
      continue
    }
    const words = tokens(report.final_viewpoint)
    const match = groups.find((group) => {
      const shared = [...words].filter((word) => group.tokens.has(word)).length
      return shared / Math.max(1, Math.min(words.size, group.tokens.size)) >= 0.3
    })
    if (match) match.report_ids.push(report.report_id)
    else
      groups.push({
        group_id: `group-${groups.length + 1}`,
        title: report.final_viewpoint,
        description: report.reasons[0]?.text ?? report.final_viewpoint,
        report_ids: [report.report_id],
        tokens: words,
      })
  }
  return {
    groups: countGroups(
      groups.map(({ tokens: _tokens, ...group }) => group),
      reports.map((report) => report.report_id),
      ungrouped,
    ),
    ungrouped,
  }
}

/** Aggregate reviewed timeline summaries without leaking private message references. */
export function summarizeViewpointTimeline(reports: IndividualReport[], groups: ViewpointGroup[]) {
  const steps = new Map<
    string,
    { reportId: string; point: import('@/api/inquiry').ViewpointTimelinePoint }[]
  >()
  for (const report of reports) {
    for (const point of report.viewpoint_timeline ?? []) {
      if (
        point.change_type === 'maintained' ||
        point.change_type === 'unassessed' ||
        (point.change_type === 'initial' && point.attribution !== 'none')
      )
        continue
      const key = `${point.turn}:${point.question}`
      const items = steps.get(key) ?? []
      items.push({ reportId: report.report_id, point })
      steps.set(key, items)
    }
  }
  return [...steps.values()]
    .sort((a, b) => a[0]!.point.turn - b[0]!.point.turn)
    .map((items): import('@/api/inquiry').ViewpointTimelinePoint => {
      const first = items[0]!.point
      const ids = new Set(items.map((item) => item.reportId))
      const before = [
        ...new Set(
          items
            .map((item) => item.point.before_summary)
            .filter((value): value is string => !!value),
        ),
      ]
      return {
        turn: first.turn,
        question: first.question,
        before_summary: before.length ? before.join('；') : null,
        after_summary: [...new Set(items.map((item) => item.point.after_summary))].join('；'),
        change_type:
          first.change_type === 'initial'
            ? 'initial'
            : new Set(items.map((item) => item.point.change_type)).size > 1
              ? 'mixed'
              : first.change_type,
        explanation: items.every((item) => item.point.attribution === 'explicit')
          ? '這些回覆明確提到提問使其補充或修正想法。'
          : '這些回覆在此提問後出現新的條件、理由或不確定之處；依對話先後整理，不推定每位學生都因同一原因改變。',
        attribution: items.every((item) => item.point.attribution === 'explicit')
          ? 'explicit'
          : first.change_type === 'initial'
            ? 'none'
            : 'sequence_only',
        affected_count: ids.size,
        related_group_ids: groups
          .filter((group) => group.report_ids.some((id) => ids.has(id)))
          .map((group) => group.group_id),
      }
    })
}
