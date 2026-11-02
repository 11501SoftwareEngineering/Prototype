<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { Search, ArrowRight, MessageCircle, Check, Clock3 } from '@lucide/vue'
import type { Topic } from '@/api/student'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import QueryState from '@/components/common/QueryState.vue'
import { useStudentCourse } from '@/composables/useCourseDetail'
import { useSearch } from '@/composables/useSearch'
import { useLocale } from '@/composables/useLocale'
const route = useRoute(),
  { t } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? ''))
const { data: course, isPending, error, refetch } = useStudentCourse(courseId)
const { keyword, results } = useSearch(
  () => course.value?.topics ?? [],
  (topic) => [topic.title, topic.description],
)
const labels: Record<Topic['status'], string> = {
  NOT_STARTED: '尚未開始',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  ABANDONED: '尚未開始',
}
function topicLink(topic: Topic): RouteLocationRaw {
  return topic.status === 'COMPLETED' && topic.session_id
    ? { name: 'StudentResult', params: { courseId: courseId.value, sessionId: topic.session_id } }
    : { name: 'StudentChat', params: { courseId: courseId.value, topicId: topic.topic_id } }
}
</script>
<template>
  <InquiryShell
    ><div class="mb-8">
      <p class="eyebrow mb-3">CHOOSE A QUESTION. FIND YOUR VOICE.</p>
      <h1 class="workspace-title">{{ course?.name ?? t('學生探究') }}</h1>
      <p class="mt-3 text-sm leading-7 text-muted-foreground">
        {{ t('這裡沒有標準答案，試著說清楚你的理由。') }}
      </p>
    </div>
    <label class="search-field mb-7 max-w-sm"
      ><Search class="size-4" /><input
        v-model="keyword"
        type="search"
        :placeholder="t('搜尋探究活動')"
        :aria-label="t('搜尋探究活動')" /></label
    ><QueryState
      :loading="isPending"
      :error="error"
      :empty="!results.length"
      :empty-text="keyword ? '找不到符合的問題' : '老師還沒有出題目，等待老師發布新的探究活動。'"
      @retry="refetch()"
      ><div class="grid gap-5 md:grid-cols-2">
        <article
          v-for="(topic, index) in results"
          :key="topic.topic_id"
          class="surface-panel flex flex-col p-6"
        >
          <div class="mb-6 flex items-center justify-between">
            <span class="text-[10px] tracking-widest text-muted-foreground"
              >INQUIRY {{ String(index + 1).padStart(2, '0') }}</span
            ><span class="status-tag" :class="topic.status === 'COMPLETED' ? 'published' : ''"
              ><Check v-if="topic.status === 'COMPLETED'" class="size-3" />{{
                t(labels[topic.status])
              }}</span
            >
          </div>
          <MessageCircle class="mb-3 size-5 text-muted-foreground/60" />
          <h2 class="text-lg font-bold leading-8">{{ topic.title }}</h2>
          <p class="mb-6 mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            {{ topic.description }}
          </p>
          <div class="flex items-center justify-between border-t border-border pt-4">
            <span class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              ><Clock3 class="size-3.5" />回合數：{{ topic.max_rounds ?? '未提供' }}</span
            ><RouterLink
              :to="topicLink(topic)"
              class="inline-flex items-center gap-2 text-xs font-medium"
              >{{
                t(
                  topic.status === 'COMPLETED'
                    ? '查看個人報告'
                    : topic.status === 'IN_PROGRESS'
                      ? '繼續探究'
                      : '開始探究',
                )
              }}<ArrowRight class="size-3.5"
            /></RouterLink>
          </div>
        </article></div></QueryState
  ></InquiryShell>
</template>
