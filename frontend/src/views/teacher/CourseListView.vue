<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { BookOpen, Plus, Search, Users, ArrowUpRight, Pencil, Trash2, Layers } from '@lucide/vue'
import { teacherApi, teacherKeys, type TeacherCourse } from '@/api/teacher'
import ModelUsagePanel from '@/components/teacher/ModelUsagePanel.vue'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CourseFormDialog from '@/components/teacher/CourseFormDialog.vue'
import { Button } from '@/components/ui/button'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useSearch } from '@/composables/useSearch'
import { useAuthStore } from '@/stores/auth'
import { useLocale } from '@/composables/useLocale'
const auth = useAuthStore()
const client = useQueryClient(),
  { t } = useLocale()
const query = useQuery({ queryKey: teacherKeys.courses, queryFn: teacherApi.getCourses })
const { keyword, results } = useSearch(
  () => query.data.value ?? [],
  (course) => [course.name, course.invite_code, course.description],
)
const formOpen = ref(false),
  editing = ref<TeacherCourse | null>(null)
function edit(course: TeacherCourse | null) {
  editing.value = course
  formOpen.value = true
}
const remove = useConfirmAction(
  (course: TeacherCourse) => teacherApi.deleteCourse(course.course_id),
  { onSuccess: () => client.invalidateQueries({ queryKey: teacherKeys.courses }) },
)
</script>
<template>
  <InquiryShell
    ><div class="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p class="eyebrow mb-3">YOUR TEACHING SPACE</p>
        <h1 class="workspace-title">{{ t('我的課程') }}</h1>
        <p class="mt-3 text-sm leading-7 text-muted-foreground">
          {{ t('一個好問題，是思考的開始。') }}
        </p>
      </div>
      <Button v-if="auth.userRole === 'TEACHER'" @click="edit(null)"
        ><Plus class="size-4" />新增課程</Button
      >
    </div>
    <ModelUsagePanel v-if="auth.userRole === 'TEACHER'" />
    <section
      class="mb-9 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-border bg-workspace p-6 text-workspace-foreground sm:p-8"
    >
      <div>
        <p class="mb-3 text-[10px] tracking-[.2em] text-workspace-accent">
          ASK. THINK. UNDERSTAND.
        </p>
        <h2 class="text-lg font-medium leading-8">{{ t('課堂中的每個想法，都值得被聽見。') }}</h2>
        <p class="mt-2 max-w-lg text-xs leading-7 text-workspace-foreground/75">
          從設定一場探究，到閱讀每個學生的理由，再把不同觀點帶回課堂。
        </p>
      </div>
      <div class="flex gap-8">
        <div>
          <p class="text-3xl font-medium">{{ query.data.value ? query.data.value.length : '—' }}</p>
          <p class="mt-2 text-[10px] text-workspace-foreground/75">進行中課程</p>
        </div>
        <div class="border-l border-workspace-foreground/10 pl-8">
          <p class="text-3xl font-medium">
            {{
              query.data.value
                ? query.data.value.reduce((sum, course) => sum + course.topic_count, 0)
                : '—'
            }}
          </p>
          <p class="mt-2 text-[10px] text-workspace-foreground/75">探究活動</p>
        </div>
      </div>
    </section>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-sm font-bold">
        {{ t('課程總覽')
        }}<span class="ml-2 text-xs font-normal text-muted-foreground">{{ results.length }}</span>
      </h2>
      <label class="search-field w-full sm:w-64"
        ><Search class="size-4" /><input
          v-model="keyword"
          type="search"
          placeholder="搜尋課程"
          aria-label="搜尋課程"
      /></label>
    </div>
    <QueryState
      :loading="query.isPending.value"
      :error="query.error.value"
      :empty="!results.length"
      :empty-text="keyword ? '找不到符合的課程' : '還沒有課程，按新增課程建立第一門課。'"
      @retry="query.refetch()"
      ><div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="course in results"
          :key="course.course_id"
          class="group surface-panel flex flex-col overflow-hidden"
        >
          <div class="flex items-start justify-between border-b border-border bg-muted/40 p-6">
            <div
              class="flex size-12 items-center justify-center rounded-xl border border-border bg-card"
            >
              <BookOpen class="size-5 text-muted-foreground" />
            </div>
            <span class="status-tag published">{{ t('進行中') }}</span>
          </div>
          <div class="flex flex-1 flex-col p-6">
            <h3 class="text-lg font-bold">
              <RouterLink :to="{ name: 'TeacherCourse', params: { courseId: course.course_id } }">{{
                course.name
              }}</RouterLink>
            </h3>
            <p class="mt-2 line-clamp-2 min-h-14 text-xs leading-7 text-muted-foreground">
              {{ course.description || '從日常問題出發，練習提問與論證。' }}
            </p>
            <div class="mb-6 mt-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span class="flex items-center gap-1.5"
                ><Users class="size-3.5" />{{ course.student_count }}</span
              ><span class="flex items-center gap-1.5"
                ><Layers class="size-3.5" />{{ course.topic_count }} {{ t('活動') }}</span
              ><span class="ml-auto font-mono">{{ course.invite_code }}</span>
            </div>
            <div class="mt-auto flex items-center justify-between border-t border-border pt-4">
              <RouterLink
                :to="{ name: 'TeacherCourse', params: { courseId: course.course_id } }"
                class="flex items-center gap-2 text-xs font-medium"
                >進入課程<ArrowUpRight class="size-3.5"
              /></RouterLink>
              <div v-if="auth.userRole === 'TEACHER'" class="flex gap-2">
                <button
                  class="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  :aria-label="`編輯 ${course.name}`"
                  @click="edit(course)"
                >
                  <Pencil class="size-3.5" /></button
                ><button
                  class="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  :aria-label="`刪除 ${course.name}`"
                  @click="remove.ask(course)"
                >
                  <Trash2 class="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </article></div
    ></QueryState>
    <CourseFormDialog v-model:open="formOpen" :course="editing" /><ConfirmDialog
      v-model:open="remove.open"
      title="刪除整個課程？"
      :description="`刪除「${remove.target?.name}」會一併永久刪除課程內全部活動、對話、個人報告、觀點摘要與成員關係，無法復原。`"
      confirm-text="刪除整個課程"
      destructive
      :loading="remove.isPending"
      :error="remove.error"
      @confirm="remove.confirm()"
    />
  </InquiryShell>
</template>
