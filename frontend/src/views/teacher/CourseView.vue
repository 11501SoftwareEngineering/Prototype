<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  Plus,
  ArrowUpRight,
  Search,
  Copy,
  Check,
  BookOpen,
  Users,
  Clock3,
  Trash2,
  ArrowLeft,
  UserMinus,
} from '@lucide/vue'
import { teacherApi, teacherKeys, type TeacherTopic, type CourseStudent } from '@/api/teacher'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import CourseTaManager from '@/components/teacher/CourseTaManager.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { useTeachingCourse } from '@/composables/useTeachingCourse'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useSearch } from '@/composables/useSearch'
import { useLocale } from '@/composables/useLocale'

const route = useRoute(),
  client = useQueryClient(),
  { t, ageLabel } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? ''))
const { data: course, isPending, error, refetch, isOwner, can } = useTeachingCourse(courseId)
const students = useQuery({
  queryKey: computed(() => teacherKeys.students(courseId.value)),
  queryFn: () => teacherApi.getCourseStudents(courseId.value),
  enabled: () => can('view_members'),
})
const { keyword, results } = useSearch(
  () => course.value?.topics ?? [],
  (topic) => [topic.title, topic.description],
)
const tab = ref<'activities' | 'members' | 'tas'>('activities'),
  copied = ref(false),
  copyError = ref('')
const deleteActivity = useConfirmAction(
  (topic: TeacherTopic) => teacherApi.deleteTopic(topic.topic_id),
  {
    onSuccess: async (topic) => {
      client.removeQueries({ queryKey: ['inquiry', topic.topic_id] })
      await client.invalidateQueries({ queryKey: teacherKeys.course(courseId.value) })
      await client.invalidateQueries({ queryKey: teacherKeys.courses })
      await client.invalidateQueries({ queryKey: ['student'] })
    },
  },
)
const remove = useConfirmAction(
  (student: CourseStudent) => teacherApi.removeStudent(courseId.value, student.student_id),
  { onSuccess: () => client.invalidateQueries({ queryKey: teacherKeys.students(courseId.value) }) },
)
const publishedCount = computed(
  () =>
    course.value?.topics.filter(
      (topic) => (topic.publication_status ?? 'published') === 'published',
    ).length ?? 0,
)
async function copyCode() {
  try {
    await navigator.clipboard.writeText(course.value?.invite_code ?? '')
    copied.value = true
    copyError.value = ''
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copyError.value = '無法自動複製，請選取課程代碼後複製。'
  }
}
</script>

<template>
  <InquiryShell>
    <RouterLink
      :to="{ name: 'TeacherCourses' }"
      class="mb-7 inline-flex items-center gap-2 text-xs text-muted-foreground"
      ><ArrowLeft class="size-3.5" />{{ t('我的課程') }}</RouterLink
    >
    <div class="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p class="eyebrow mb-2">THE CLASSROOM</p>
        <h1 class="workspace-title">{{ course?.name ?? t('課程總覽') }}</h1>
        <p class="mt-3 text-sm text-muted-foreground">
          {{ t('管理課程中的探究，讓不同觀點在對話裡浮現。') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button v-if="can('edit_activities')" as-child :disabled="!course"
          ><RouterLink :to="{ name: 'TeacherSetup', params: { courseId } }"
            ><Plus class="size-4" />{{ t('新增探究') }}</RouterLink
          ></Button
        >
      </div>
    </div>
    <div
      v-if="course"
      class="mb-8 grid divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      <div class="flex items-center gap-4 p-5">
        <div class="rounded-lg bg-muted p-2.5">
          <BookOpen class="size-4 text-muted-foreground" />
        </div>
        <div>
          <p class="text-[11px] text-muted-foreground">{{ t('已發布') }}{{ t('活動') }}</p>
          <p class="mt-1 text-xl font-medium">{{ publishedCount }}</p>
        </div>
      </div>
      <div class="flex items-center gap-4 p-5">
        <div class="rounded-lg bg-muted p-2.5"><Users class="size-4 text-muted-foreground" /></div>
        <div>
          <p class="text-[11px] text-muted-foreground">{{ t('課程成員') }}</p>
          <p class="mt-1 text-xl font-medium">
            {{ students.data.value?.length ?? course?.student_count ?? '—' }}
          </p>
        </div>
      </div>
      <div v-if="can('view_members')" class="flex items-center justify-between gap-3 p-5">
        <div>
          <p class="text-[11px] text-muted-foreground">{{ t('課程代碼') }}</p>
          <p class="mt-2 select-all font-mono text-base tracking-widest">
            {{ course.invite_code }}
          </p>
        </div>
        <button
          class="rounded-lg p-2 hover:bg-muted"
          :aria-label="t(copied ? '已複製' : '複製代碼')"
          @click="copyCode"
        >
          <Check v-if="copied" class="size-4 text-chart-1" /><Copy
            v-else
            class="size-4 text-muted-foreground"
          />
        </button>
      </div>
    </div>
    <p v-if="copyError" role="status" class="mb-4 text-xs text-destructive">{{ copyError }}</p>
    <div class="workspace-tabs">
      <button
        class="workspace-tab"
        :class="{ selected: tab === 'activities' }"
        :aria-pressed="tab === 'activities'"
        @click="tab = 'activities'"
      >
        {{ t('活動') }}
        <span class="ml-1.5 text-muted-foreground">{{ course?.topics.length ?? 0 }}</span></button
      ><button
        v-if="can('view_members')"
        class="workspace-tab"
        :class="{ selected: tab === 'members' }"
        :aria-pressed="tab === 'members'"
        @click="tab = 'members'"
      >
        {{ t('課程成員') }}</button
      ><button
        v-if="isOwner"
        class="workspace-tab"
        :class="{ selected: tab === 'tas' }"
        :aria-pressed="tab === 'tas'"
        @click="tab = 'tas'"
      >
        助教與權限
      </button>
    </div>
    <template v-if="tab === 'activities'"
      ><label class="search-field mb-6 max-w-sm"
        ><Search class="size-4" /><input
          v-model="keyword"
          type="search"
          :placeholder="t('搜尋探究活動')"
          :aria-label="t('搜尋探究活動')" /></label
      ><QueryState
        :loading="isPending"
        :error="error"
        :empty="results.length === 0"
        :empty-text="keyword ? '找不到符合的問題' : t('尚未有探究活動')"
        @retry="refetch()"
        ><div class="grid gap-5 md:grid-cols-2">
          <article
            v-for="(topic, index) in results"
            :key="topic.topic_id"
            class="group surface-panel flex flex-col p-6 transition-all hover:border-primary"
          >
            <div class="mb-5 flex items-center justify-between">
              <span class="text-[10px] tracking-widest text-muted-foreground/70"
                >INQUIRY {{ String(index + 1).padStart(2, '0') }}</span
              ><span class="status-tag" :class="topic.publication_status ?? 'published'">{{
                t(topic.publication_status === 'draft' ? '草稿' : '已發布')
              }}</span>
            </div>
            <h2 class="mb-2 text-lg font-bold leading-8">
              <RouterLink
                :to="{
                  name: topic.publication_status === 'draft' ? 'TeacherSetupEdit' : 'TeacherTopic',
                  params: { courseId, topicId: topic.topic_id },
                }"
                >{{ topic.title }}</RouterLink
              >
            </h2>
            <p class="mb-6 line-clamp-2 text-sm leading-7 text-muted-foreground">
              {{ topic.description || '從不同角度出發，練習提問與論證。' }}
            </p>
            <div
              class="mb-6 mt-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground"
            >
              <span>{{ ageLabel(topic.age_range) }}</span
              ><span class="flex items-center gap-1"
                ><Clock3 class="size-3" />{{ topic.max_rounds ?? '—' }} {{ t('回合') }}</span
              ><span class="ml-auto flex items-center gap-1"
                ><Users class="size-3" />{{ topic.answered_count }} /
                {{ students.data.value?.length ?? course?.student_count ?? '—' }}</span
              >
            </div>
            <div class="flex items-center justify-between border-t border-border pt-4">
              <RouterLink
                :to="{
                  name: topic.publication_status === 'draft' ? 'TeacherSetupEdit' : 'TeacherTopic',
                  params: { courseId, topicId: topic.topic_id },
                }"
                class="inline-flex items-center gap-2 text-xs font-medium"
                >{{ t(topic.publication_status === 'draft' ? '繼續設定' : '檢視觀點')
                }}<ArrowUpRight
                  class="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></RouterLink
              ><button
                class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
                v-if="isOwner"
                :aria-label="`刪除 ${topic.title}`"
                @click="deleteActivity.ask(topic)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </article></div></QueryState
    ></template>
    <CourseTaManager v-else-if="tab === 'tas' && isOwner" :course-id="courseId" />
    <QueryState
      v-else-if="tab === 'members' && can('view_members')"
      :loading="students.isPending.value"
      :error="students.error.value"
      :empty="students.data.value?.length === 0"
      empty-text="還沒有學生加入，請分享課程代碼。"
      @retry="students.refetch()"
      ><div class="surface-panel divide-y divide-border">
        <div
          v-for="student in students.data.value"
          :key="student.student_id"
          class="flex items-center gap-4 px-5 py-4"
        >
          <div class="flex size-9 items-center justify-center rounded-full bg-muted text-sm">
            {{ student.name.slice(0, 1) }}
          </div>
          <div class="min-w-0">
            <p class="text-sm">{{ student.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ student.account }}</p>
          </div>
          <button
            class="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
            v-if="isOwner"
            :aria-label="`移除 ${student.name}`"
            @click="remove.ask(student)"
          >
            <UserMinus class="size-4" />
          </button>
        </div></div
    ></QueryState>
    <ConfirmDialog
      v-model:open="deleteActivity.open"
      :title="`刪除活動「${deleteActivity.target?.title ?? ''}」？`"
      description="將永久刪除此活動及其所有對話紀錄、個人報告與全班摘要，學生將無法繼續或查看結果。課程與其他活動不受影響，此操作無法復原。"
      confirm-text="刪除活動"
      destructive
      :loading="deleteActivity.isPending"
      :error="deleteActivity.error"
      @confirm="deleteActivity.confirm()"
    />
    <ConfirmDialog
      v-model:open="remove.open"
      title="移除課程成員？"
      description="移除後立即撤銷課程存取權，既有對話與報告仍依保存政策保留。"
      confirm-text="確認移除"
      destructive
      :loading="remove.isPending"
      :error="remove.error"
      @confirm="remove.confirm()"
    />
  </InquiryShell>
</template>
