<script setup lang="ts">
/**
 * 註冊頁（學生自己註冊）。對應 Figma「Register」（node 163:82）。
 * API：POST /auth/register，成功後直接幫他登入。
 *
 * 後端註冊需要「姓名」，但 Figma 沒有這個欄位，所以先用帳號名稱當姓名。
 */
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMutation } from '@tanstack/vue-query'
import { authApi } from '@/api/auth'
import AppLogo from '@/components/common/AppLogo.vue'
import AuthCard from '@/components/common/AuthCard.vue'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/utils'
import { HOME_ROUTE, useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({ account: '', password: '', confirm: '' })
const errors = reactive({ account: '', password: '', confirm: '' })
const formError = ref('')

const mutation = useMutation({
  mutationFn: async () => {
    const account = form.account.trim()
    await authApi.register({ account, password: form.password, name: account })
    return authStore.login({ account, password: form.password })
  },
  onSuccess: (user) => router.replace({ name: HOME_ROUTE[user.role] }),
  onError: (error) => {
    formError.value = getApiErrorMessage(error, '註冊失敗，請稍後再試')
  },
})

function handleSubmit() {
  const account = form.account.trim()
  errors.account = !account ? '請輸入帳號名稱' : account.length > 64 ? '帳號名稱最多 64 個字' : ''
  errors.password = form.password.length >= 8 ? '' : '密碼至少要 8 個字元'
  errors.confirm = form.confirm === form.password ? '' : '兩次輸入的密碼不一樣'
  formError.value = ''
  if (errors.account || errors.password || errors.confirm) return
  mutation.mutate()
}
</script>

<template>
  <AuthCard>
    <AppLogo :size="160" class="mx-auto" />

    <form class="mt-8 flex flex-col gap-5" novalidate @submit.prevent="handleSubmit">
      <FormField
        v-slot="field"
        label="帳號名稱"
        hint="登入時使用，最多 64 個字"
        :error="errors.account"
      >
        <Input v-model="form.account" v-bind="field" autocomplete="username" />
      </FormField>
      <FormField v-slot="field" label="建立密碼" hint="至少 8 個字元" :error="errors.password">
        <Input v-model="form.password" v-bind="field" type="password" autocomplete="new-password" />
      </FormField>
      <FormField v-slot="field" label="確認密碼" :error="errors.confirm || formError">
        <Input v-model="form.confirm" v-bind="field" type="password" autocomplete="new-password" />
      </FormField>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-body text-foreground">
          已經有帳號了嗎？
          <RouterLink
            :to="{ name: 'Login' }"
            class="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >點此登入</RouterLink
          >
        </p>
        <Button type="submit" size="lg" class="ml-auto" :disabled="mutation.isPending.value">
          {{ mutation.isPending.value ? '註冊中…' : '註冊' }}
        </Button>
      </div>
    </form>
  </AuthCard>
</template>
