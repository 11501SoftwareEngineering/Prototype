<script setup lang="ts">
/**
 * 僅初次登入可設定新密碼。沒有一般帳號選單入口、郵件或忘記密碼流程。
 */
import { reactive, ref, watch } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { authApi } from '@/api/auth'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const errors = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const formError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, { oldPassword: '', newPassword: '', confirm: '' })
  Object.assign(errors, { oldPassword: '', newPassword: '', confirm: '' })
  formError.value = ''
})

const mutation = useMutation({
  mutationFn: () =>
    authApi.changePassword({ old_password: form.oldPassword, new_password: form.newPassword }),
  onSuccess: () => {
    authStore.markPasswordChanged()
    open.value = false
  },
  onError: (error) => {
    formError.value = getApiErrorMessage(error, '修改失敗，請稍後再試')
  },
})

function handleSubmit() {
  if (!authStore.mustChangePassword) return
  errors.oldPassword = form.oldPassword ? '' : '請輸入原密碼'
  errors.newPassword = form.newPassword.length >= 8 ? '' : '新密碼至少要 8 個字元'
  errors.confirm = form.confirm === form.newPassword ? '' : '兩次輸入的新密碼不一樣'
  formError.value = ''
  if (errors.oldPassword || errors.newPassword || errors.confirm) return
  mutation.mutate()
}
</script>

<template>
  <FormDialog
    v-model:open="open"
    title="設定首次登入密碼"
    description="這是第一次登入，請先把管理員給你的初始密碼改成自己的密碼。完成後不提供自行修改密碼功能。"
    submit-text="設定密碼"
    cancel-text="登出"
    :dismissible="false"
    :loading="mutation.isPending.value"
    :error="formError"
    @submit="handleSubmit"
    @cancel="authStore.logout()"
  >
    <FormField v-slot="field" label="原密碼" :error="errors.oldPassword">
      <Input
        v-model="form.oldPassword"
        v-bind="field"
        type="password"
        autocomplete="current-password"
      />
    </FormField>
    <FormField v-slot="field" label="新密碼" hint="至少 8 個字元" :error="errors.newPassword">
      <Input
        v-model="form.newPassword"
        v-bind="field"
        type="password"
        autocomplete="new-password"
      />
    </FormField>
    <FormField v-slot="field" label="確認新密碼" :error="errors.confirm">
      <Input v-model="form.confirm" v-bind="field" type="password" autocomplete="new-password" />
    </FormField>
  </FormDialog>
</template>
