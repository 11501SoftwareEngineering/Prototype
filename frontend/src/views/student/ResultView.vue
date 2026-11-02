<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { ArrowLeft, Check, ShieldCheck, Clock3, Layers } from '@lucide/vue'
import { studentApi, studentKeys } from '@/api/student'
import { inquiryApi, inquiryKeys } from '@/api/inquiry'
import InquirySteps from '@/components/inquiry/InquirySteps.vue'
import ReportViewer from '@/components/inquiry/ReportViewer.vue'
import SummaryPanel from '@/components/inquiry/SummaryPanel.vue'
import QueryState from '@/components/common/QueryState.vue'
import { Button } from '@/components/ui/button'
import { useStudentCourse } from '@/composables/useCourseDetail'
import { useLocale } from '@/composables/useLocale'

const route = useRoute(),
  { t } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? '')),
  sessionId = computed(() => String(route.params.sessionId ?? ''))
const tab = ref<'report' | 'transcript' | 'summary'>('report')
const reportQuery = useQuery({
  queryKey: computed(() => inquiryKeys.report(sessionId.value)),
  queryFn: () => inquiryApi.getReport(sessionId.value),
  refetchInterval: (query) =>
    ['pending', 'processing'].includes(query.state.data?.status ?? '') ? 3000 : false,
})
const report = computed(() => reportQuery.data.value?.report)
const topicId = computed(() => report.value?.topic_id ?? '')
const messages = useQuery({
  queryKey: computed(() => studentKeys.messages(sessionId.value)),
  queryFn: () => studentApi.getSessionMessages(sessionId.value),
  enabled: () => !!report.value,
})
const published = useQuery({
  queryKey: computed(() => inquiryKeys.published(topicId.value)),
  queryFn: () => inquiryApi.getPublishedSummary(topicId.value),
  enabled: () => !!topicId.value,
  refetchInterval: 15000,
})
const { data: course } = useStudentCourse(courseId)
const topic = computed(() => course.value?.topics.find((item) => item.topic_id === topicId.value))
async function showEvidence(id: string) {
  tab.value = 'transcript'
  await nextTick()
  document.getElementById(`message-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
</script>
<template>
  <div class="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
    <RouterLink
      :to="{ name: 'StudentCourse', params: { courseId } }"
      class="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
      ><ArrowLeft class="size-3.5" />{{ t('返回課程') }}</RouterLink
    ><InquirySteps :active="3" />
    <div class="mb-8">
      <p class="eyebrow mb-2">REFLECT ON YOUR INQUIRY</p>
      <h1 class="workspace-title">{{ topic?.title ?? t('個人報告') }}</h1>
      <p class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Check class="size-3.5 text-chart-1" />{{ t('對話完成') }}<span class="mx-1">·</span
        >{{ t('你的想法，值得再回顧一次。') }}
      </p>
    </div>
    <QueryState
      :loading="reportQuery.isPending.value"
      :error="reportQuery.error.value"
      @retry="reportQuery.refetch()"
      ><div v-if="reportQuery.data.value?.status !== 'ready' || !report" class="empty-state">
        <Clock3 class="mx-auto mb-4 size-7 text-muted-foreground/50" />
        <h2 class="mb-3 text-base font-bold">
          {{ t(reportQuery.data.value?.status === 'failed' ? '報告產生失敗' : '報告產生中') }}
        </h2>
        <p>{{ t('對話已完成，報告就緒後將顯示在這裡。') }}</p>
        <Button variant="outline" class="mt-5" @click="reportQuery.refetch()">{{
          t('重新載入')
        }}</Button>
      </div>
      <template v-else
        ><div class="workspace-tabs">
          <button
            v-for="item in [
              { key: 'report', label: '個人報告' },
              { key: 'transcript', label: '對話紀錄' },
              { key: 'summary', label: '全班摘要' },
            ] as const"
            :key="item.key"
            class="workspace-tab"
            :class="{ selected: tab === item.key }"
            :aria-pressed="tab === item.key"
            @click="tab = item.key"
          >
            {{ t(item.label) }}
          </button>
        </div>
        <section v-if="tab === 'report'" class="surface-panel p-6 sm:p-9">
          <ReportViewer :report="report" show-transcript-link @evidence="showEvidence" />
        </section>
        <QueryState
          v-else-if="tab === 'transcript'"
          :loading="messages.isPending.value"
          :error="messages.error.value"
          @retry="messages.refetch()"
          ><ol class="surface-panel divide-y divide-border px-5 sm:px-8">
            <li
              v-for="(message, index) in messages.data.value?.messages ?? []"
              :id="`message-${message.message_id}`"
              :key="message.message_id"
              class="scroll-mt-8 py-6"
            >
              <p class="mb-3 text-[10px] text-muted-foreground">
                {{ t(message.role === 'assistant' ? '蘇格拉底' : '你') }} · {{ t('回合') }}
                {{ Math.floor(index / 2) + 1 }}
              </p>
              <p class="whitespace-pre-wrap text-sm leading-8">{{ message.content }}</p>
            </li>
          </ol></QueryState
        >
        <QueryState
          v-else
          :loading="published.isPending.value"
          :error="published.error.value"
          @retry="published.refetch()"
          ><SummaryPanel
            v-if="published.data.value?.summary"
            :summary="published.data.value.summary"
          />
          <section v-else class="empty-state py-16">
            <Layers class="mx-auto mb-5 size-8 text-muted-foreground/40" />
            <h2 class="text-base font-bold text-foreground">{{ t('老師尚未發布全班摘要') }}</h2>
            <p class="mt-3">{{ t('發布後，你可以在這裡看見不同觀點與觀點變化。') }}</p>
          </section>
          <p class="mt-5 flex items-center gap-2 text-[11px] leading-6 text-muted-foreground">
            <ShieldCheck class="size-3.5 shrink-0" />{{
              t('不公開個人報告、匿名代碼或其他學生的原話。')
            }}
          </p></QueryState
        >
      </template></QueryState
    >
  </div>
</template>
