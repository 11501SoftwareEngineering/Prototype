import type { Db, DbSession } from './db'
import type { ClassSummary, IndividualReport, InquirySetup } from '@/api/inquiry'
import { groupDemoReports, summarizeViewpointTimeline } from '@/lib/inquiry'

/** Upgrade only the built-in example once. Deleted examples stay deleted. */
export function installCompletedExample(db: Db) {
  if (db.completed_example_version === 5) return
  db.completed_example_version = 5
  const topic = db.topics.find((item) => item.id === 't-lie')
  if (!topic) return
  const learners = db.enrollments
    .filter((item) => item.course_id === topic.course_id && item.role !== 'TA')
    .slice(0, 12)
  if (!learners.length) return
  const setup: InquirySetup = {
    age_band: '13-15',
    max_turns: 5,
    topic: topic.title,
    core_question: '為了保護別人的感受，什麼時候可以說善意的謊言？',
    inquiry_focus: '比較動機、後果與信任，提出理由並回應反例。',
    background_info: '朋友送你一份不合心意的禮物，問你是否喜歡。請比較不同回應的影響。',
    exclusions: '不討論真實同學的私人事件。',
    opening_message: '朋友送你一份不合心意的禮物，問你是否喜歡。你會如何回應？請說明一個理由。',
  }
  Object.assign(topic, {
    setup,
    setup_version: 1,
    publication_status: 'published',
    model_id: 'gpt-6-luna',
    source_language: 'zh-TW',
    age_range: setup.age_band,
    max_rounds: setup.max_turns,
  })
  // Remove the separate temporary example created during frontend development.
  db.topics = db.topics.filter((item) => item.id !== 't-demo-c-phil')
  db.sessions = db.sessions.filter(
    (item) => item.topic_id !== topic.id && item.topic_id !== 't-demo-c-phil',
  )
  const completedAt = new Date().toISOString()
  const reports: IndividualReport[] = []
  const statements = [
    [
      '善意謊言可以保護感受，但不能影響他人的重大決定。',
      '我一開始覺得善意的謊言有時可以，因為不想讓朋友因為禮物難過。',
      '如果只是小事，我認為短暫的安慰比直接批評更有幫助。',
      '但如果對方需要根據我的回答做重要決定，隱瞞就會傷害他的選擇權。',
      '這個反例讓我修正了原本只在意當下感受的想法。現在我也會考慮對方的知情權與長期傷害。',
    ],
    [
      '誠實與信任應該優先，可以用溫和表達代替說謊。',
      '我傾向誠實回應，會謝謝朋友，也坦白說這份禮物不太符合我的需要。',
      '一次善意的謊言被發現，可能讓對方懷疑我以後說的話。',
      '我理解有些人想避免傷心，但可以調整說話方式，而不改變事實。',
      '這個問題讓我補充了表達方式。我仍重視誠實，但會更注意說話的時間與語氣。',
    ],
    [
      '應依關係與情境判斷，先了解對方真正需要的回應。',
      '同一句話對不同的人可能有不同影響，我會先了解對方的期待。',
      '有時對方在詢問事實，有時只是在尋求支持，兩種情況需要不同回應。',
      '如果涉及健康或安全，我會選擇說清楚，即使可能讓對方不高興。',
      '經過這個問題，我更確定不能只用能不能說謊來分類，而應先確認對方需要什麼，並留意健康與安全的界線。',
    ],
    [
      '還不確定，想繼續比較保護感受與誠實的界線。',
      '我一開始覺得說喜歡就好，因為不希望朋友難過。',
      '但如果朋友以後一直買類似的禮物，隱瞞可能讓問題更嚴重。',
      '我也不確定直接說不喜歡是否一定比較好，還想比較不同說法。',
      '這個問題讓我發現自己還缺少判斷標準。我需要更多例子，才能判斷何時應該安慰、何時應該說清楚。',
    ],
  ]
  const allocation = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3]

  const stages = [
    [
      '初步認為善意謊言有時可以，主要為了不傷害朋友。',
      '小事可以先安慰，但尚未說明重要程度的界線。',
      '補上限制：涉及重大決定時，應尊重對方的知情權。',
      '從只看當下感受，修正為同時考慮知情權與長期傷害。',
    ],
    [
      '傾向誠實回應，同時感謝對方心意。',
      '以被發現說謊後的信任損害，支持誠實優先。',
      '維持誠實立場，補充可以調整說話方式照顧感受。',
      '明確補充說話的時間與語氣，仍重視誠實。',
    ],
    [
      '先了解對方的期待，避免一概判斷。',
      '區分詢問事實與尋求支持兩種需求。',
      '補上健康與安全的界線：這些情況應說清楚。',
      '維持依情境判斷，保留資訊需求及健康安全條件。',
    ],
    [
      '起初傾向說喜歡，以免朋友難過。',
      '想到隱瞞的長期影響，開始質疑原先的簡單回應。',
      '仍不確定哪一種說法較好，尚未形成取捨標準。',
      '明確表示需要更多例子，尚無法決定何時安慰、何時說清楚。',
    ],
  ]
  const changes: import('@/api/inquiry').ViewpointTimelinePoint['change_type'][][] = [
    ['initial', 'clarified', 'clarified', 'revised', 'maintained'],
    ['initial', 'clarified', 'clarified', 'clarified', 'maintained'],
    ['initial', 'clarified', 'clarified', 'maintained', 'maintained'],
    ['initial', 'uncertain', 'maintained', 'clarified', 'maintained'],
  ]
  learners.forEach((learner, index) => {
    const lines = statements[allocation[index] ?? 0]!
    const replies = [lines[1]!, lines[2]!, lines[3]!, lines[4]!, lines[0]!]
    const prompts = [
      setup.opening_message,
      '這個理由在什麼情況下可能不成立？',
      '站在另一方的角度，你會怎麼回應？',
      '思考反例之後，你的判斷有改變嗎？',
      '最後，你會如何說明目前的立場？',
    ]
    const sessionId = `sess-lie-example-${learner.student_id}`
    const session: DbSession = {
      id: sessionId,
      topic_id: topic.id,
      student_id: learner.student_id,
      status: 'COMPLETED',
      is_anonymous: true,
      conclusion_id: null,
      summary: '',
      setup_snapshot: { ...setup },
      model_id: topic.model_id,
      completion_reason: 'max_turns',
      completed_at: completedAt,
      messages: replies.flatMap((reply, turn) => [
        { id: `${sessionId}-q${turn + 1}`, role: 'assistant' as const, content: prompts[turn]! },
        { id: `${sessionId}-a${turn + 1}`, role: 'user' as const, content: reply },
      ]),
    }
    const undetermined = allocation[index] === 3
    const report: IndividualReport = {
      report_id: `report-${sessionId}`,
      version: 1,
      session_id: sessionId,
      topic_id: topic.id,
      anonymous_id: `S-D${String(index + 1).padStart(2, '0')}`,
      completed_at: completedAt,
      completed_turns: 5,
      completion_reason: 'max_turns',
      inquiry_summary: '從禮物情境出發，討論保護感受、誠實與重大決定的界線，並回應不同立場。',
      viewpoint_summary: undetermined
        ? '學生從不希望朋友難過出發，之後提出隱瞞可能造成長期影響的反例。對話最後仍表示不確定，尚未說明保護感受與誠實衝突時的取捨標準；不能據此歸為支持或反對說謊。'
        : [
            `學生有條件接受善意謊言，理由是避免小事造成不必要的難過；但在涉及重大決定時，認為應尊重對方知道事實的權利。對話中補充了對長期傷害的考量。`,
            `學生優先考慮誠實與長期信任，主張用溫和語氣照顧感受，而不改變事實。其回應補充了表達的時間與方式，沒有改為支持說謊。`,
            `學生認為應先了解對方需要事實還是情緒支持，再依關係與情境回應；但將健康與安全視為需要說清楚的情況。其立場是條件判斷，並非任何情況都可以說謊。`,
          ][allocation[index] ?? 0]!,
      evidence_status: undetermined ? 'partial' : 'sufficient',
      strongest_reason: undetermined
        ? null
        : {
            text: replies[1]!,
            evidence: { message_id: `${sessionId}-a2`, turn: 2, quote: replies[1]! },
          },
      tested_challenges: [
        {
          challenge: prompts[2]!,
          response: replies[2]!,
          evidence: { message_id: `${sessionId}-a3`, turn: 3, quote: replies[2]! },
        },
      ],
      revision_or_defense: undetermined
        ? '學生看見短期安慰與長期影響的衝突，但仍未提出穩定的取捨標準。對話不足以確認其已完成立場修正。'
        : replies[3]!,
      focus_connection: [
        '以感受、長期傷害及重大決定中的知情權，連結動機、後果與信任的探究重點。',
        '以被發現說謊後的長期信任，連結誠實與溫和表達的區別。',
        '以事實資訊與情緒支持的不同需求，說明情境如何影響判斷。',
        '已注意到短期感受與長期後果，但尚未說明兩者衝突時如何權衡。',
      ][allocation[index] ?? 0]!,
      viewpoint_timeline: replies.map((answer, turn) => {
        const category = allocation[index] ?? 0
        const summaries = [...stages[category]!, replies[4]!]
        const change = changes[category]![turn]!
        return {
          turn: turn + 1,
          question: prompts[turn]!,
          question_message_id: `${sessionId}-q${turn + 1}`,
          answer: { message_id: `${sessionId}-a${turn + 1}`, turn: turn + 1, quote: answer },
          before_summary: turn ? summaries[turn - 1]! : null,
          after_summary: summaries[turn]!,
          change_type: change,
          attribution:
            turn === 0
              ? ('none' as const)
              : turn === 3 && category !== 2
                ? ('explicit' as const)
                : ('sequence_only' as const),
          explanation:
            change === 'initial'
              ? '記錄學生的初步回覆。'
              : change === 'maintained'
                ? '學生重新確認原有判斷，沒有足夠證據將此回覆判為立場轉變。'
                : turn === 3 && category !== 2
                  ? '學生明確表示這個問題讓其補充或修正想法。'
                  : '此提問後，學生補充了新的理由、條件或不確定之處；不另行推定因果。',
        }
      }),
      final_viewpoint: undetermined ? null : replies[4]!,
      viewpoint_status: undetermined ? 'undetermined' : 'expressed',
      reasons: [0, 1, 2].map((turn) => ({
        text: replies[turn]!,
        evidence: {
          message_id: `${sessionId}-a${turn + 1}`,
          turn: turn + 1,
          quote: replies[turn]!,
        },
      })),
      other_perspectives: [replies[2]!],
      viewpoint_changes: [{ turn: 4, text: replies[3]! }],
      open_questions: ['當兩個價值都很重要時，還有哪些回應方式值得比較？'],
      limitations: [
        ...(undetermined
          ? ['學生尚未說明保護感受與誠實之間的取捨標準。']
          : ['尚未透過更多情境檢驗目前判斷的適用界線。']),
        '此為可操作的虛構教學示範資料。',
      ],
    }
    session.report = report
    db.sessions.push(session)
    reports.push(report)
  })
  const { groups, ungrouped } = groupDemoReports(reports)
  const descriptions = [
    '接受善意謊言，但將是否影響他人重大選擇作為界線。',
    '重視誠實與長期信任，主張用語氣與表達方式照顧感受。',
    '先釐清對方需要事實資訊還是情緒支持，再依情境回應。',
  ]
  groups.forEach((group, index) => {
    group.description = descriptions[index] ?? group.description
  })
  const viewpoints = groups
    .map((group) => `${group.count} 位學生認為「${group.title.replace(/。$/, '')}」`)
    .join('；')
  const summary: ClassSummary = {
    summary_id: 'summary-lie-example',
    version: 1,
    status: 'published',
    topic_id: topic.id,
    overview: `全班 ${learners.length} 位學生已完成這次探究，個人報告整理出 ${groups.length} 組相近觀點${ungrouped.length ? `，另有 ${ungrouped.length} 位仍在思考立場` : ''}。不同觀點分別重視感受、信任及具體情境，可作為下一次全班討論的起點。`,
    viewpoint_summary: `${viewpoints}。${ungrouped.length ? `另有 ${ungrouped.length} 位仍未確定立場，不能歸為支持或反對。` : ''}各組的主要差異在於價值的優先順序與判斷條件，尚未形成一致的取捨標準。`,
    viewpoint_timeline: summarizeViewpointTimeline(reports, groups),
    groups,
    ungrouped_report_ids: ungrouped,
    ungrouped_count: ungrouped.length,
    report_count: reports.length,
    completed_count: reports.length,
    roster_count: db.enrollments.filter(
      (item) => item.course_id === topic.course_id && item.role !== 'TA',
    ).length,
    generated_at: completedAt,
    published_at: completedAt,
  }
  topic.summary_draft = JSON.parse(JSON.stringify(summary)) as ClassSummary
  topic.summary_published = JSON.parse(JSON.stringify(summary)) as ClassSummary
}
