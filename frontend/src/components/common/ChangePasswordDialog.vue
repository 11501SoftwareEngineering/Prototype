<script setup lang="ts">
/**
 * 首次登入強制設定及帳號選單主動修改共用同一份密碼表單。
 */
import { reactive, ref, watch } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { authApi } from '@/api/auth'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useLocale } from '@/composables/useLocale'

const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const { t } = useLocale()
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const errors = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const formError = ref('')

watch(open, () => {
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
  if (!authStore.isAuthenticated || mutation.isPending.value) return
  errors.oldPassword = form.oldPassword ? '' : '請輸入原密碼'
  errors.newPassword =
    form.newPassword.length < 8
      ? '新密碼至少要 8 個字元'
      : form.newPassword.length > 128
        ? '新密碼最多 128 個字元'
        : form.newPassword === form.oldPassword
          ? '新密碼不能與原密碼相同'
          : ''
  errors.confirm = form.confirm === form.newPassword ? '' : '兩次輸入的新密碼不一樣'
  formError.value = ''
  if (errors.oldPassword || errors.newPassword || errors.confirm) return
  mutation.mutate()
}
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="t(authStore.mustChangePassword ? '設定首次登入密碼' : '修改密碼')"
    :description="
      t(
        authStore.mustChangePassword
          ? '這是第一次登入，請先把管理員給你的初始密碼改成自己的密碼。'
          : '請輸入原密碼，並設定新的密碼。',
      )
    "
    :submit-text="t(authStore.mustChangePassword ? '設定密碼' : '修改密碼')"
    :cancel-text="t(authStore.mustChangePassword ? '登出' : '取消')"
    :dismissible="!authStore.mustChangePassword && !mutation.isPending.value"
    :loading="mutation.isPending.value"
    :error="formError"
    @submit="handleSubmit"
    @cancel="authStore.mustChangePassword ? authStore.logout() : (open = false)"
  >
    <FormField v-slot="field" :label="t('原密碼')" :error="t(errors.oldPassword)">
      <Input
        v-model="form.oldPassword"
        v-bind="field"
        type="password"
        autocomplete="current-password"
      />
    </FormField>
    <FormField
      v-slot="field"
      :label="t('新密碼')"
      :hint="t('8 至 128 個字元')"
      :error="t(errors.newPassword)"
    >
      <Input
        v-model="form.newPassword"
        v-bind="field"
        type="password"
        autocomplete="new-password"
      />
    </FormField>
    <FormField v-slot="field" :label="t('確認新密碼')" :error="t(errors.confirm)">
      <Input v-model="form.confirm" v-bind="field" type="password" autocomplete="new-password" />
    </FormField>
  </FormDialog>
</template>
