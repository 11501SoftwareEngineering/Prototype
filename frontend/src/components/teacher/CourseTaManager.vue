<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Plus, Trash2, ShieldCheck } from '@lucide/vue'
import {
  TA_PERMISSIONS,
  DEFAULT_TA_PERMISSIONS,
  taApi,
  taKeys,
  type TaPermission,
  type CourseTa,
} from '@/api/ta'
import { teacherKeys } from '@/api/teacher'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { getApiErrorMessage } from '@/lib/utils'
const props = defineProps<{ courseId: string }>()
const client = useQueryClient(),
  account = ref(''),
  newPermissions = ref<TaPermission[]>([...DEFAULT_TA_PERMISSIONS]),
  notice = ref(''),
  error = ref('')
const query = useQuery({
  queryKey: computed(() => taKeys.members(props.courseId)),
  queryFn: () => taApi.getMembers(props.courseId),
})
const selected = reactive<Record<string, TaPermission[]>>({})
watch(
  () => query.data.value,
  (members) => {
    for (const member of members ?? []) selected[member.student_id] = [...member.permissions]
  },
  { immediate: true },
)
async function refresh() {
  await client.invalidateQueries({ queryKey: taKeys.members(props.courseId) })
  await client.invalidateQueries({ queryKey: teacherKeys.course(props.courseId) })
  await client.invalidateQueries({ queryKey: teacherKeys.students(props.courseId) })
  await client.invalidateQueries({ queryKey: teacherKeys.courses })
}
const add = useMutation({
  mutationFn: () =>
    taApi.addMember(props.courseId, account.value.trim(), [...newPermissions.value]),
  onSuccess: async () => {
    account.value = ''
    error.value = ''
    notice.value = '已加入課程助教。'
    await refresh()
  },
  onError: (err) => (error.value = getApiErrorMessage(err)),
})
const save = useMutation({
  mutationFn: (member: CourseTa) =>
    taApi.updateMember(props.courseId, member.student_id, [...(selected[member.student_id] ?? [])]),
  onSuccess: async () => {
    error.value = ''
    notice.value = '已儲存助教權限，後續操作會立即依新權限檢查。'
    await refresh()
  },
  onError: (err) => (error.value = getApiErrorMessage(err)),
})
const remove = useConfirmAction(
  (member: CourseTa) => taApi.removeMember(props.courseId, member.student_id),
  {
    onSuccess: async () => {
      notice.value = '已移除助教資格。'
      await refresh()
    },
  },
)
const changed = (member: CourseTa) =>
  [...(selected[member.student_id] ?? [])].sort().join(',') !==
  [...member.permissions].sort().join(',')
</script>
<template>
  <div class="space-y-6">
    <section class="surface-panel p-6">
      <h2 class="mb-2 flex items-center gap-2 text-base font-bold">
        <ShieldCheck class="size-4" />助教權限
      </h2>
      <p class="mb-5 text-xs leading-7 text-muted-foreground">
        助教可查看被指派課程的活動與摘要，其他操作由老師逐項勾選。活動與摘要的發布、刪除及 API key
        設定由老師執行。
      </p>
      <form @submit.prevent="add.mutate()">
        <label for="ta-account" class="field-label">助教帳號</label>
        <div class="flex flex-wrap gap-3">
          <input
            id="ta-account"
            v-model="account"
            class="workspace-input min-w-0 flex-1"
            autocomplete="off"
            placeholder="輸入已註冊帳號，例如 ta"
            required
          /><Button type="submit" :disabled="!account.trim() || add.isPending.value"
            ><Plus class="size-4" />加入助教</Button
          >
        </div>
        <fieldset class="mt-5 grid gap-3 sm:grid-cols-2">
          <legend class="sr-only">新助教的權限</legend>
          <label
            v-for="permission in TA_PERMISSIONS"
            :key="permission.key"
            class="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4"
            ><input
              v-model="newPermissions"
              type="checkbox"
              :value="permission.key"
              class="mt-1 accent-current"
              :disabled="add.isPending.value"
            /><span
              ><span class="text-xs font-medium">{{ permission.label }}</span
              ><span class="mt-1 block text-[11px] leading-6 text-muted-foreground">{{
                permission.description
              }}</span></span
            ></label
          >
        </fieldset>
        <p class="mt-4 text-[11px] leading-6 text-muted-foreground">
          若指定原本的課程學生為助教，該帳號不再計入學生名單，原對話與報告會保留。
        </p>
      </form>
    </section>
    <p v-if="notice" role="status" class="text-xs leading-6 text-chart-1">{{ notice }}</p>
    <p v-if="error" role="alert" class="text-xs leading-6 text-destructive">{{ error }}</p>
    <QueryState
      :loading="query.isPending.value"
      :error="query.error.value"
      :empty="!query.data.value?.length"
      empty-text="尚未加入助教。"
      @retry="query.refetch()"
      ><div class="space-y-4">
        <section
          v-for="member in query.data.value"
          :key="member.student_id"
          class="surface-panel p-6"
        >
          <div class="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-bold">
                {{ member.name
                }}<span class="ml-2 text-xs font-normal text-muted-foreground">{{
                  member.account
                }}</span>
              </h3>
              <p class="mt-2 text-[11px] text-muted-foreground">僅限本課程的授權</p>
            </div>
            <button
              class="rounded p-2 text-muted-foreground hover:text-destructive"
              :aria-label="`移除助教 ${member.name}`"
              @click="remove.ask(member)"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
          <fieldset class="grid gap-3 sm:grid-cols-2">
            <legend class="sr-only">{{ member.name }} 的權限</legend>
            <label
              v-for="permission in TA_PERMISSIONS"
              :key="permission.key"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4"
              ><input
                v-model="selected[member.student_id]"
                type="checkbox"
                :value="permission.key"
                class="mt-1 accent-current"
                :disabled="save.isPending.value"
              /><span
                ><span class="text-xs font-medium">{{ permission.label }}</span
                ><span class="mt-1 block text-[11px] leading-6 text-muted-foreground">{{
                  permission.description
                }}</span></span
              ></label
            >
          </fieldset>
          <div class="mt-5 flex justify-end">
            <Button
              variant="outline"
              :disabled="!changed(member) || save.isPending.value"
              @click="save.mutate(member)"
              >儲存權限</Button
            >
          </div>
        </section>
      </div></QueryState
    >
    <ConfirmDialog
      v-model:open="remove.open"
      title="移除課程助教？"
      description="移除後立即撤銷此課程的助教存取權。若原本是課程學生，會恢復學生身分，既有紀錄會保留。"
      confirm-text="移除助教"
      destructive
      :loading="remove.isPending"
      :error="remove.error"
      @confirm="remove.confirm()"
    />
  </div>
</template>
