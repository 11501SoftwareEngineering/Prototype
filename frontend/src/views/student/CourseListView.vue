<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Plus, BookOpen, Search, ArrowUpRight, LogOut, Compass } from '@lucide/vue'
import { studentApi, studentKeys, type Course } from '@/api/student'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import QueryState from '@/components/common/QueryState.vue'
import JoinCourseDialog from '@/components/student/JoinCourseDialog.vue'
import { Button } from '@/components/ui/button'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useSearch } from '@/composables/useSearch'
import { useLocale } from '@/composables/useLocale'
const client = useQueryClient(),
  { t } = useLocale()
const query = useQuery({ queryKey: studentKeys.courses, queryFn: studentApi.getCourses })
const { keyword, results } = useSearch(
  () => query.data.value ?? [],
  (course) => [course.name, course.invite_code, course.teacher_name],
)
const joinOpen = ref(false),
  notice = ref('')
const leave = useConfirmAction((course: Course) => studentApi.leaveCourse(course.course_id), {
  onSuccess: (course) => {
    notice.value = `已退出「${course.name}」`
    return client.invalidateQueries({ queryKey: studentKeys.courses })
  },
})
</script>
<template>
  <InquiryShell
    ><div class="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p class="eyebrow mb-3">YOUR LEARNING JOURNEY</p>
        <h1 class="workspace-title">{{ t('我的課程') }}</h1>
        <p class="mt-3 text-sm leading-7 text-muted-foreground">
          {{ t('這裡沒有標準答案，試著說清楚你的理由。') }}
        </p>
      </div>
      <Button @click="joinOpen = true"><Plus class="size-4" />加入課程</Button>
    </div>
    <section
      class="mb-8 flex items-center gap-5 rounded-xl border border-border bg-workspace p-6 text-workspace-foreground sm:p-8"
    >
      <Compass class="hidden size-10 shrink-0 text-workspace-accent sm:block" />
      <div>
        <p class="mb-2 text-[10px] tracking-[.2em] text-workspace-accent">STAY CURIOUS.</p>
        <h2 class="text-lg leading-8">每一次追問，都讓想法更清楚一點。</h2>
        <p class="mt-2 text-xs leading-7 text-workspace-foreground/75">
          從課程選擇一個問題，展開屬於你的探究。
        </p>
      </div>
    </section>
    <p v-if="notice" role="status" class="mb-4 text-sm text-chart-1">{{ notice }}</p>
    <label class="search-field mb-6 max-w-sm"
      ><Search class="size-4" /><input
        v-model="keyword"
        type="search"
        placeholder="搜尋課程"
        aria-label="搜尋課程" /></label
    ><QueryState
      :loading="query.isPending.value"
      :error="query.error.value"
      :empty="!results.length"
      :empty-text="keyword ? '找不到符合的課程' : '還沒有加入課程，輸入老師提供的代碼開始。'"
      @retry="query.refetch()"
      ><div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="course in results"
          :key="course.course_id"
          class="surface-panel flex flex-col p-6"
        >
          <BookOpen class="mb-5 size-7 text-muted-foreground/70" />
          <h2 class="text-lg font-bold">
            <RouterLink :to="{ name: 'StudentCourse', params: { courseId: course.course_id } }">{{
              course.name
            }}</RouterLink>
          </h2>
          <p class="mt-3 text-xs text-muted-foreground">
            {{ course.teacher_name }} · {{ course.active_topic_count }} {{ t('活動') }}
          </p>
          <p class="mb-7 mt-2 text-xs text-muted-foreground">
            {{ t('課程代碼') }} <span class="font-mono">{{ course.invite_code }}</span>
          </p>
          <div class="mt-auto flex items-center justify-between border-t border-border pt-4">
            <RouterLink
              :to="{ name: 'StudentCourse', params: { courseId: course.course_id } }"
              class="flex items-center gap-2 text-xs font-medium"
              >進入課程<ArrowUpRight class="size-3.5" /></RouterLink
            ><button
              class="rounded p-1.5 text-muted-foreground hover:bg-muted"
              :aria-label="`退出 ${course.name}`"
              @click="leave.ask(course)"
            >
              <LogOut class="size-3.5" />
            </button>
          </div>
        </article></div></QueryState
    ><JoinCourseDialog
      v-model:open="joinOpen"
      @joined="(name) => (notice = `已加入「${name}」`)" /><ConfirmDialog
      v-model:open="leave.open"
      title="退出課程？"
      description="退出後將撤銷課程存取權，重新加入需要課程代碼。"
      confirm-text="確認退出"
      :loading="leave.isPending"
      :error="leave.error"
      @confirm="leave.confirm()"
  /></InquiryShell>
</template>
