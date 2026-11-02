<script setup lang="ts">
/**
 * 管理員：老師帳號管理。對應 Figma「Admin_Home」（node 171:119）、「AddTeacher」「Comfire」。
 * API：GET/POST /admin/teachers、DELETE /admin/teachers/{id}
 *      ⚠️ 重設密碼 POST /admin/teachers/{id}/reset-password 是前端假設的
 *
 * Figma 的「建立教師帳號」要管理員自己輸入密碼，但後端是自動產生一次性初始密碼，
 * 所以表單改成輸入帳號和姓名，建立後顯示初始密碼。
 */
import { reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { adminApi, adminKeys, type Teacher, type TeacherPasswordResponse } from '@/api/admin'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import ListCard from '@/components/common/ListCard.vue'
import ListSection from '@/components/common/ListSection.vue'
import PasswordNoticeDialog from '@/components/common/PasswordNoticeDialog.vue'
import QueryState from '@/components/common/QueryState.vue'
import { AddRingIcon, RefreshIcon, TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/composables/useSearch'
import { formatDate, getApiErrorMessage } from '@/lib/utils'

const queryClient = useQueryClient()
const { data, isPending, error, refetch } = useQuery({
  queryKey: adminKeys.teachers,
  queryFn: adminApi.getTeachers,
})
const { keyword, results } = useSearch(
  () => data.value ?? [],
  (t) => [t.account, t.name],
)
const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.teachers })

// ----- 新增老師 -----
const createOpen = ref(false)
const form = reactive({ account: '', name: '' })
const errors = reactive({ account: '', name: '', form: '' })

function openCreate() {
  Object.assign(form, { account: '', name: '' })
  Object.assign(errors, { account: '', name: '', form: '' })
  createOpen.value = true
}

// ----- 顯示初始密碼 -----
const notice = ref<(TeacherPasswordResponse & { title: string }) | null>(null)
const noticeOpen = ref(false)
function showPassword(result: TeacherPasswordResponse, title: string) {
  notice.value = { ...result, title }
  noticeOpen.value = true
}

const createMutation = useMutation({
  mutationFn: () =>
    adminApi.createTeacher({ account: form.account.trim(), name: form.name.trim() }),
  onSuccess: (result) => {
    createOpen.value = false
    void refresh()
    showPassword(result, '已建立教師帳號')
  },
  onError: (err) => (errors.form = getApiErrorMessage(err, '建立失敗，請稍後再試')),
})

function handleCreate() {
  errors.account = form.account.trim() ? '' : '請輸入帳號名稱'
  errors.name = form.name.trim() ? '' : '請輸入老師姓名'
  errors.form = ''
  if (errors.account || errors.name) return
  createMutation.mutate()
}

// ----- 重設密碼、刪除 -----
const target = ref<Teacher | null>(null)
const resetOpen = ref(false)
const deleteOpen = ref(false)
const actionError = ref('')

function ask(teacher: Teacher, action: 'reset' | 'delete') {
  target.value = teacher
  actionError.value = ''
  if (action === 'reset') resetOpen.value = true
  else deleteOpen.value = true
}

const resetMutation = useMutation({
  mutationFn: (id: string) => adminApi.resetTeacherPassword(id),
  onSuccess: (result) => {
    resetOpen.value = false
    showPassword(result, '已重設密碼')
  },
  onError: (err) => (actionError.value = getApiErrorMessage(err, '重設失敗，請稍後再試')),
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => adminApi.deleteTeacher(id),
  onSuccess: () => {
    deleteOpen.value = false
    void refresh()
  },
  onError: (err) => (actionError.value = getApiErrorMessage(err, '刪除失敗，請稍後再試')),
})
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-4 py-10 sm:py-12">
    <ListSection v-model:search="keyword" title="老師管理" search-label="搜尋老師">
      <template #actions>
        <Button @click="openCreate">新增老師 <AddRingIcon /></Button>
      </template>

      <QueryState
        :loading="isPending"
        :error="error"
        :empty="results.length === 0"
        :empty-text="keyword ? '找不到符合的老師' : '目前還沒有老師帳號，按「新增老師」建立第一個'"
        error-text="無法取得老師列表"
        @retry="refetch()"
      >
        <ListCard
          v-for="teacher in results"
          :key="teacher.id"
          :title="`帳號：${teacher.account}`"
          :description="`姓名：${teacher.name}　建立於 ${formatDate(teacher.created_at)}`"
        >
          <template #actions>
            <Button
              variant="secondary"
              :aria-label="`重設 ${teacher.name} 的密碼`"
              @click="ask(teacher, 'reset')"
            >
              <span class="hidden sm:inline">重設密碼</span> <RefreshIcon />
            </Button>
            <Button
              variant="destructive"
              :aria-label="`刪除 ${teacher.name}`"
              @click="ask(teacher, 'delete')"
            >
              <span class="hidden sm:inline">刪除</span> <TrashIcon />
            </Button>
          </template>
        </ListCard>
      </QueryState>
    </ListSection>

    <FormDialog
      v-model:open="createOpen"
      title="建立教師帳號"
      description="建立後系統會產生一組初始密碼，老師第一次登入時要自己改密碼。"
      :loading="createMutation.isPending.value"
      :error="errors.form"
      @submit="handleCreate"
    >
      <FormField v-slot="field" label="帳號名稱" hint="老師登入時使用" :error="errors.account">
        <Input v-model="form.account" v-bind="field" autocomplete="off" />
      </FormField>
      <FormField v-slot="field" label="老師姓名" hint="會顯示在學生的課程列表" :error="errors.name">
        <Input v-model="form.name" v-bind="field" autocomplete="off" />
      </FormField>
    </FormDialog>

    <ConfirmDialog
      v-model:open="resetOpen"
      title="確認重設密碼?"
      :description="`會產生一組新的初始密碼，「${target?.name}」原本的密碼將無法使用。`"
      confirm-text="重設"
      :loading="resetMutation.isPending.value"
      :error="actionError"
      @confirm="target && resetMutation.mutate(target.id)"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="確認刪除?"
      :description="`刪除後「${target?.name}」將無法登入，這個動作無法復原。`"
      confirm-text="確認"
      destructive
      :loading="deleteMutation.isPending.value"
      :error="actionError"
      @confirm="target && deleteMutation.mutate(target.id)"
    />

    <PasswordNoticeDialog
      v-if="notice"
      v-model:open="noticeOpen"
      :title="notice.title"
      :account="notice.account"
      :name="notice.name"
      :password="notice.password"
    />
  </div>
</template>
