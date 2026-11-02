<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Users,
  FileText,
  Layers,
  Search,
  Check,
  ShieldCheck,
  Clock3,
  Tag,
  X,
} from '@lucide/vue'
import { inquiryApi, inquiryKeys, type IndividualReport, type ViewpointGroup } from '@/api/inquiry'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import InquirySteps from '@/components/inquiry/InquirySteps.vue'
import SummaryPanel from '@/components/inquiry/SummaryPanel.vue'
import ReportViewer from '@/components/inquiry/ReportViewer.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Dialog, DialogScrollContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTeachingCourse } from '@/composables/useTeachingCourse'
import { useLocale } from '@/composables/useLocale'
import { getApiErrorMessage, formatDate } from '@/lib/utils'

const route = useRoute(),
  router = useRouter(),
  client = useQueryClient(),
  { t } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? '')),
  topicId = computed(() => String(route.params.topicId ?? ''))
const {
  data: course,
  isOwner,
  can,
  error: courseError,
  isPending: coursePending,
} = useTeachingCourse(courseId)
const topic = computed(() => course.value?.topics.find((item) => item.topic_id === topicId.value))
const reports = useQuery({
  queryKey: computed(() => inquiryKeys.reports(topicId.value)),
  queryFn: () => inquiryApi.getReports(topicId.value),
  enabled: () => can('view_reports'),
})
const summaryQuery = useQuery({
  queryKey: computed(() => inquiryKeys.summary(topicId.value)),
  queryFn: () => inquiryApi.getSummary(topicId.value),
  refetchOnWindowFocus: false,
  enabled: () => !!course.value,
})
const summary = computed(
  () => summaryQuery.data.value?.draft ?? summaryQuery.data.value?.published ?? null,
)
const tab = computed<'summary' | 'reports'>({
  get: () => (route.query.tab === 'reports' && can('view_reports') ? 'reports' : 'summary'),
  set: (value) => {
    void router.replace({ query: { ...route.query, tab: value } })
  },
})
const tabs = computed(() => [
  { id: 'summary' as const, label: '摘要審閱' },
  ...(can('view_reports') ? [{ id: 'reports' as const, label: '學生報告' }] : []),
])
watch(
  () => route.query.tab,
  (value) => {
    if (value === 'preview') tab.value = 'summary'
  },
  { immediate: true },
)
watch(
  () => can('view_reports'),
  (allowed) => {
    if (!allowed) {
      reportOpen.value = false
      selected.value = null
    }
  },
)
const search = ref(''),
  error = ref(''),
  notice = ref('')
const selected = ref<IndividualReport | null>(null),
  reportOpen = ref(false)
const publishOpen = ref(false),
  withdrawOpen = ref(false),
  acknowledged = ref(false)
const overview = ref(''),
  viewpointSummary = ref('')
const dirty = computed(
  () =>
    !isOwner.value &&
    can('edit_summary') &&
    !!summary.value &&
    (overview.value !== summary.value.overview ||
      viewpointSummary.value !== (summary.value.viewpoint_summary ?? summary.value.overview)),
)
const hasNewReports = computed(() => {
  const included = new Set(
    summary.value
      ? [
          ...summary.value.groups.flatMap((group) => group.report_ids),
          ...summary.value.ungrouped_report_ids,
        ]
      : [],
  )
  return (
    !!summary.value && reports.data.value?.reports.some((report) => !included.has(report.report_id))
  )
})
const tagOptions = computed(() => [
  ...(summary.value?.groups.map((group) => ({
    id: group.group_id,
    label: group.title,
    count: group.count,
  })) ?? []),
  ...(summary.value?.ungrouped_count
    ? [{ id: 'undetermined', label: t('尚未形成明確觀點'), count: summary.value.ungrouped_count }]
    : []),
])
const reportTagMap = computed(() => {
  const tags = new Map<string, { id: string; label: string }>()
  for (const group of summary.value?.groups ?? []) {
    for (const id of group.report_ids) tags.set(id, { id: group.group_id, label: group.title })
  }
  for (const id of summary.value?.ungrouped_report_ids ?? [])
    tags.set(id, { id: 'undetermined', label: t('尚未形成明確觀點') })
  return tags
})
function reportTag(report: IndividualReport) {
  return reportTagMap.value.get(report.report_id) ?? { id: 'pending', label: t('待重新分群') }
}
const selectedTag = computed(() => (typeof route.query.tag === 'string' ? route.query.tag : ''))
const selectedTagLabel = computed(
  () =>
    tagOptions.value.find((tag) => tag.id === selectedTag.value)?.label ??
    (selectedTag.value === 'pending' ? t('待重新分群') : '此分類已更新'),
)
const filtered = computed(() =>
  (reports.data.value?.reports ?? []).filter((report) => {
    const tag = reportTag(report)
    return (
      (!selectedTag.value || tag.id === selectedTag.value) &&
      `${report.anonymous_id} ${report.final_viewpoint ?? ''} ${tag.label} ${tag.id}`
        .toLowerCase()
        .includes(search.value.trim().toLowerCase())
    )
  }),
)
async function selectTag(id: string) {
  search.value = ''
  await router.replace({ query: { ...route.query, tab: 'reports', tag: id || undefined } })
}
watch(
  summary,
  (value) => {
    if (value) {
      overview.value = value.overview
      viewpointSummary.value = value.viewpoint_summary ?? value.overview
    }
    acknowledged.value = false
  },
  { immediate: true },
)
onBeforeRouteLeave(() => !dirty.value || window.confirm('摘要有未儲存修訂，確定離開嗎？'))
async function refresh() {
  await client.invalidateQueries({ queryKey: inquiryKeys.summary(topicId.value) })
}
function failed(err: unknown) {
  error.value = getApiErrorMessage(err)
}
const generate = useMutation({
  mutationFn: () => inquiryApi.generateSummary(topicId.value),
  onSuccess: async () => {
    error.value = ''
    tab.value = 'summary'
    await refresh()
  },
  onError: failed,
})
const save = useMutation({
  mutationFn: () =>
    inquiryApi.updateSummary(topicId.value, {
      version: summary.value!.version,
      overview: overview.value,
      viewpoint_summary: viewpointSummary.value,
    }),
  onSuccess: async () => {
    error.value = ''
    notice.value = t('儲存成功')
    await refresh()
  },
  onError: failed,
})
const review = useMutation({
  mutationFn: () => inquiryApi.reviewSummary(topicId.value, summary.value!.version),
  onSuccess: async () => {
    error.value = ''
    await refresh()
  },
  onError: failed,
})
const publish = useMutation({
  mutationFn: () => inquiryApi.publishSummary(topicId.value, summary.value!.version),
  onSuccess: async () => {
    error.value = ''
    publishOpen.value = false
    notice.value = '已發布給學生。後續資料更新會另存為新草稿。'
    await refresh()
    await client.invalidateQueries({ queryKey: inquiryKeys.published(topicId.value) })
  },
  onError: failed,
})
const withdraw = useMutation({
  mutationFn: () =>
    inquiryApi.withdrawSummary(topicId.value, summaryQuery.data.value!.published!.version),
  onSuccess: async () => {
    error.value = ''
    withdrawOpen.value = false
    await refresh()
  },
  onError: failed,
})
const busy = computed(
  () =>
    generate.isPending.value ||
    save.isPending.value ||
    review.isPending.value ||
    publish.isPending.value ||
    withdraw.isPending.value,
)
function selectGroup(group: ViewpointGroup) {
  void selectTag(group.group_id)
}
function read(report: IndividualReport) {
  selected.value = report
  reportOpen.value = true
}
function regenerate() {
  if (!dirty.value || window.confirm('重新整理將取代未儲存的摘要修訂，確定繼續嗎？'))
    generate.mutate()
}
</script>

<template>
  <InquiryShell>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        :to="{ name: 'TeacherCourse', params: { courseId } }"
        class="inline-flex items-center gap-2 text-xs text-muted-foreground"
        ><ArrowLeft class="size-3.5" />{{ t('返回課程') }}</RouterLink
      ><RouterLink
        v-if="can('edit_activities') && topic?.publication_status === 'draft'"
        :to="{ name: 'TeacherSetupEdit', params: { courseId, topicId } }"
        class="inline-flex items-center gap-2 text-xs text-muted-foreground"
        ><SlidersHorizontal class="size-3.5" />{{ t('編輯設定') }}</RouterLink
      >
    </div>
    <InquirySteps :active="3" />
    <div class="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p class="eyebrow mb-2">A CLASSROOM OF PERSPECTIVES</p>
        <h1 class="workspace-title">{{ topic?.title ?? t('全班觀點') }}</h1>
        <p class="mt-3 text-sm leading-7 text-muted-foreground">
          {{ t('依個人報告動態整理觀點，審閱後再分享給全班。') }}
        </p>
      </div>
      <Button
        v-if="can('edit_summary')"
        :disabled="
          busy ||
          !(reports.data.value?.reports.length ?? summary?.report_count ?? topic?.answered_count) ||
          !!summaryQuery.error.value ||
          summaryQuery.isPending.value
        "
        @click="regenerate"
        ><Sparkles class="size-4" />{{
          t(generate.isPending.value ? '處理中' : summary ? '重新整理摘要' : '產生觀點摘要')
        }}</Button
      >
    </div>
    <div
      v-if="error"
      role="alert"
      class="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {{ error }}
    </div>
    <p v-if="notice" role="status" class="mb-5 text-sm text-chart-1">{{ notice }}</p>
    <div class="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="(stat, index) in [
          {
            label: '全班人數',
            value:
              reports.data.value?.roster_count ?? summary?.roster_count ?? course?.student_count,
            icon: Users,
          },
          {
            label: '完成對話',
            value:
              reports.data.value?.completed_count ??
              summary?.completed_count ??
              topic?.answered_count,
            icon: Check,
          },
          {
            label: '可用報告',
            value: reports.data.value?.reports.length ?? summary?.report_count,
            icon: FileText,
          },
          { label: '觀點群組', value: summary?.groups.length, icon: Layers },
        ]"
        :key="stat.label"
        class="surface-panel px-5 py-4"
      >
        <div class="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{{ t(stat.label) }}</span
          ><component :is="stat.icon" class="size-3.5" />
        </div>
        <p class="text-2xl font-medium tabular-nums">
          {{ stat.value ?? '—'
          }}<span
            v-if="index === 2 && reports.data.value"
            class="ml-2 text-xs text-muted-foreground"
            >/ {{ reports.data.value.completed_count }}</span
          >
        </p>
      </div>
    </div>
    <p
      v-if="
        reports.data.value && (reports.data.value.pending_count || reports.data.value.failed_count)
      "
      class="mb-5 rounded-lg bg-primary/10 p-4 text-xs leading-6"
    >
      {{ reports.data.value.pending_count }} 份報告待處理，{{ reports.data.value.failed_count }}
      份失敗；尚未納入觀點分布。
    </p>
    <p
      v-if="hasNewReports"
      role="status"
      class="mb-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-xs leading-6"
    >
      有新的可用報告。重新整理會建立新草稿，已發布內容保持不變。
    </p>
    <div class="workspace-tabs">
      <button
        v-for="item in tabs"
        :key="item.id"
        class="workspace-tab"
        :class="{ selected: tab === item.id }"
        :aria-pressed="tab === item.id"
        @click="tab = item.id"
      >
        {{ t(item.label) }}
      </button>
    </div>
    <QueryState
      v-if="tab === 'reports'"
      :loading="reports.isPending.value"
      :error="courseError ?? reports.error.value"
      :empty="filtered.length === 0 && !reports.data.value?.reports.length"
      empty-text="學生完成對話後，個人報告會出現在這裡。"
      @retry="reports.refetch()"
    >
      <div class="mb-5 flex flex-wrap gap-3">
        <label class="search-field min-w-0 flex-1"
          ><Search class="size-4" /><input
            v-model="search"
            type="search"
            :placeholder="t('搜尋匿名代碼、觀點或 tag')"
            :aria-label="t('搜尋匿名代碼、觀點或 tag')"
        /></label>
        <Button v-if="selectedTag" variant="outline" @click="selectTag('')"
          ><X class="size-3.5" />{{ t('清除 tag') }}</Button
        >
      </div>
      <div v-if="tagOptions.length" class="mb-5 flex flex-wrap gap-2" aria-label="依觀點 tag 篩選">
        <button
          v-for="tag in tagOptions"
          :key="tag.id"
          type="button"
          class="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-[11px] transition-colors"
          :class="
            selectedTag === tag.id
              ? 'border-primary bg-primary/15 text-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary'
          "
          :aria-pressed="selectedTag === tag.id"
          :title="tag.label"
          @click="selectTag(tag.id)"
        >
          <Tag class="size-3 shrink-0" /><span class="max-w-56 truncate">{{ tag.label }}</span
          ><span class="shrink-0 tabular-nums">{{ tag.count }}</span>
        </button>
      </div>
      <p v-if="selectedTag" role="status" class="mb-4 text-xs leading-6 text-muted-foreground">
        {{ t('目前 tag') }}：<strong class="font-medium text-foreground">{{
          selectedTagLabel
        }}</strong>
        · {{ filtered.length }} {{ t('份報告') }}
      </p>
      <div v-if="!filtered.length" class="empty-state">找不到符合的報告。</div>
      <div v-else class="surface-panel divide-y divide-border">
        <div
          v-for="report in filtered"
          :key="report.report_id"
          class="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5 transition-colors hover:bg-muted/40"
        >
          <button class="flex min-w-0 flex-1 items-center gap-4 text-left" @click="read(report)">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
              ><FileText class="size-4 text-muted-foreground"
            /></span>
            <span class="min-w-0 flex-1"
              ><span
                class="mb-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground"
                ><span class="font-mono">{{ report.anonymous_id }}</span
                ><span>{{ report.completed_turns }} {{ t('回合') }}</span
                ><span>{{ formatDate(report.completed_at) }}</span></span
              ><span class="block truncate text-sm">{{
                report.final_viewpoint || t('尚未形成明確觀點')
              }}</span></span
            ><ArrowRight class="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[10px] text-foreground hover:bg-primary/20"
            :title="reportTag(report).label"
            :aria-label="`篩選 tag：${reportTag(report).label}`"
            @click="selectTag(reportTag(report).id)"
          >
            <Tag class="size-3 shrink-0" /><span class="max-w-48 truncate">{{
              reportTag(report).label
            }}</span>
          </button>
        </div>
      </div>
    </QueryState>
    <QueryState
      v-else
      :loading="coursePending || summaryQuery.isPending.value || generate.isPending.value"
      :error="courseError ?? summaryQuery.error.value"
      @retry="summaryQuery.refetch()"
    >
      <div v-if="!summary" class="empty-state py-20">
        <Layers class="mx-auto mb-5 size-9 text-muted-foreground/40" />
        <h2 class="mb-3 text-base font-bold text-foreground">{{ t('尚未產生摘要') }}</h2>
        <p>{{ t('報告就緒後，產生全班觀點摘要。') }}</p>
        <p class="mt-3 text-xs">{{ t('教師審閱後，學生才能看到全班摘要。') }}</p>
      </div>
      <template v-else>
        <div class="mb-5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span
            class="status-tag"
            :class="summary.status === 'published' ? 'published' : 'draft'"
            >{{
              t(
                summary.status === 'published'
                  ? '已發布'
                  : summary.status === 'reviewed'
                    ? '已審閱'
                    : '草稿',
              )
            }}</span
          ><span>v{{ summary.version }}</span
          ><span class="inline-flex items-center gap-1"
            ><Clock3 class="size-3" />{{ formatDate(summary.generated_at) }}</span
          >
        </div>
        <SummaryPanel
          :summary="summary"
          :interactive="can('view_reports')"
          :show-timeline="false"
          @group="selectGroup"
        />
        <template v-if="tab === 'summary' && can('edit_summary')"
          ><section v-if="!isOwner" class="surface-panel mt-7 p-6 sm:p-8">
            <div class="mb-6 flex items-center gap-2">
              <ShieldCheck class="size-4 text-chart-1" />
              <h2 class="text-sm font-bold">{{ t('編輯全班摘要') }}</h2>
            </div>
            <label for="summary-overview" class="field-label">{{ t('全班概述') }}</label
            ><textarea
              id="summary-overview"
              v-model="overview"
              rows="4"
              class="workspace-input"
              :disabled="busy"
            /><label for="summary-viewpoint" class="field-label mt-6">{{ t('觀點總結') }}</label
            ><textarea
              id="summary-viewpoint"
              v-model="viewpointSummary"
              rows="5"
              class="workspace-input"
              :disabled="busy"
            />
            <p class="field-help">
              依報告確認各組立場、條件與未定之處，不將未回答的內容寫成學生已認同。
            </p>
            <p class="field-help">編輯後須重新儲存及審閱；人數與比例由報告資料計算。</p>
            <div class="mt-5 flex justify-end">
              <Button
                variant="outline"
                :disabled="busy || !dirty || !overview.trim() || !viewpointSummary.trim()"
                @click="save.mutate()"
                >{{ t('儲存修訂') }}</Button
              >
            </div>
          </section>
          <p v-if="!isOwner" class="mt-5 text-xs leading-7 text-muted-foreground">
            助教可儲存摘要草稿，審閱與發布由課程老師執行。
          </p>
          <section v-if="isOwner" class="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-6">
            <p class="mb-4 text-xs leading-6 text-muted-foreground">
              {{ t('不公開個人報告、匿名代碼或其他學生的原話。') }}
            </p>
            <label
              v-if="summary.status === 'draft'"
              class="flex cursor-pointer items-start gap-3 text-xs leading-7"
              ><input
                v-model="acknowledged"
                type="checkbox"
                class="mt-1.5 accent-current"
                :disabled="busy || dirty"
              /><span>我已確認統計範圍、群組觀點、公開表述與觀點總結。</span></label
            >
            <div class="mt-4 flex flex-wrap items-center justify-end gap-3">
              <Button
                v-if="summaryQuery.data.value?.published"
                variant="outline"
                :disabled="busy"
                @click="withdrawOpen = true"
                >{{ t('撤回發布') }}</Button
              ><Button
                v-if="summary.status === 'draft'"
                :disabled="!acknowledged || busy || dirty"
                @click="review.mutate()"
                ><Check class="size-4" />{{ t('標記審閱完成') }}</Button
              ><Button
                v-if="summary.status === 'reviewed'"
                :disabled="busy || dirty"
                @click="publishOpen = true"
                >{{ t('發布給學生') }}<ArrowRight class="size-4" /></Button
              ><span
                v-if="summary.status === 'published'"
                class="inline-flex items-center gap-2 text-xs text-chart-1"
                ><Check class="size-4" />{{ t('已發布') }}</span
              >
            </div>
          </section></template
        ></template
      >
    </QueryState>
    <Dialog v-model:open="reportOpen"
      ><DialogScrollContent class="max-w-4xl rounded-2xl bg-background p-6 sm:p-8"
        ><DialogTitle class="mb-2 text-xl font-bold">{{ t('個人報告') }}</DialogTitle
        ><DialogDescription class="mb-7"
          >僅授權教學人員可讀取。學生版全班摘要不提供個人報告入口。</DialogDescription
        >
        <p v-if="selected" class="mb-5 text-xs leading-6 text-muted-foreground">
          {{ t('觀點 tag') }}：{{ reportTag(selected).label }}
        </p>
        <ReportViewer v-if="selected" :report="selected" /></DialogScrollContent
    ></Dialog>
    <ConfirmDialog
      v-model:open="publishOpen"
      :title="t('發布給學生')"
      description="學生將看到目前已審閱的摘要版本。後續新增報告或修訂不會自動變更已發布內容。"
      :confirm-text="t('發布給學生')"
      :loading="publish.isPending.value"
      :error="error"
      @confirm="publish.mutate()"
    />
    <ConfirmDialog
      v-model:open="withdrawOpen"
      :title="t('撤回發布')"
      description="撤回後，學生將無法取得這份全班摘要。教師仍可保留草稿並重新審閱。"
      :confirm-text="t('撤回發布')"
      :loading="withdraw.isPending.value"
      :error="error"
      @confirm="withdraw.mutate()"
    />
  </InquiryShell>
</template>
