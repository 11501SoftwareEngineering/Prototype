<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRight,
  MessageCircle,
  Compass,
  Layers,
  BookOpen,
  Quote,
  Check,
  GraduationCap,
  Users,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { homeRouteFor, useAuthStore } from '@/stores/auth'
import { useLocale } from '@/composables/useLocale'
import { getApiErrorMessage } from '@/lib/utils'
const auth = useAuthStore(),
  router = useRouter(),
  { t } = useLocale()
const demo = import.meta.env.VITE_USE_MOCK === 'true'
const signingIn = ref(false),
  error = ref('')
async function enterDemo(account: string) {
  if (!demo || signingIn.value) return
  signingIn.value = true
  error.value = ''
  try {
    const user = await auth.login({ account, password: 'password123' })
    await router.push({ name: homeRouteFor(user) })
  } catch (err) {
    error.value = getApiErrorMessage(err)
  } finally {
    signingIn.value = false
  }
}
</script>
<template>
  <div class="mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
    <div class="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
      <section>
        <p class="eyebrow mb-7 flex items-center gap-2">
          <span class="h-px w-7 bg-primary" />A SPACE FOR BETTER QUESTIONS
        </p>
        <h1 class="text-4xl font-bold leading-[1.65] tracking-tight sm:text-5xl">
          從一個好問題，<br />開始一場<span class="relative whitespace-nowrap"
            >真正的思考<span class="absolute inset-x-0 -bottom-2 -z-10 h-3 bg-primary/35" /></span
          >。
        </h1>
        <p class="mt-7 max-w-md text-sm leading-8 text-muted-foreground">
          讓 AI 成為提問的夥伴，讓學生說出自己的理由。從個別探究到全班對話，看見每個觀點的可能。
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <Button as-child size="lg"
            ><RouterLink :to="auth.user ? { name: homeRouteFor(auth.user) } : { name: 'Login' }"
              >{{ t(auth.userRole ? '我的課程' : '開始探究')
              }}<ArrowRight class="ml-3 size-4" /></RouterLink></Button
          ><Button as-child variant="outline" size="lg"
            ><RouterLink :to="{ name: 'Announcements' }"
              ><BookOpen class="size-4" />{{ t('公告') }}</RouterLink
            ></Button
          >
        </div>
        <div class="mt-9 flex flex-wrap gap-5 text-[11px] text-muted-foreground">
          <span class="flex items-center gap-1.5"
            ><Check class="size-3 text-chart-1" />蘇格拉底式提問</span
          ><span class="flex items-center gap-1.5"
            ><Check class="size-3 text-chart-1" />獨立對話脈絡</span
          ><span class="flex items-center gap-1.5"
            ><Check class="size-3 text-chart-1" />教師審閱發布</span
          >
        </div>
      </section>
      <section
        class="relative rounded-2xl border border-border bg-workspace p-6 text-workspace-foreground sm:p-8"
      >
        <div
          class="mb-8 flex items-center justify-between border-b border-workspace-foreground/10 pb-5"
        >
          <div class="flex items-center gap-2.5">
            <Compass class="size-5 text-workspace-accent" /><span class="text-xs tracking-wider"
              >THE SOCRATIC SPACE</span
            >
          </div>
          <span
            class="rounded-full border border-primary/30 px-2.5 py-1 text-[9px] text-workspace-accent"
            >INQUIRY 01</span
          >
        </div>
        <Quote class="mb-4 size-6 text-workspace-accent" />
        <p class="text-xl leading-10">為了拯救多數，<br />我們可以犧牲一個人嗎？</p>
        <p class="mb-7 mt-4 text-xs leading-7 text-workspace-foreground/75">
          一個思想實驗，沒有預設的答案。<br />只有值得繼續追問的理由。
        </p>
        <div
          class="ml-7 rounded-xl border border-workspace-foreground/10 bg-workspace-foreground/5 p-4 text-xs leading-7"
        >
          「我覺得不能只看人數，還要考慮……」
        </div>
        <div class="mt-4 flex items-start gap-3">
          <span
            class="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-workspace-accent"
            ><MessageCircle class="size-3"
          /></span>
          <p class="text-xs leading-7 text-workspace-foreground/75">
            如果你站在另一個人的位置，<br />你的判斷會改變嗎？
          </p>
        </div>
        <div
          class="mt-8 border-t border-workspace-foreground/10 pt-5 text-[9px] tracking-widest text-workspace-foreground/75"
        >
          ASK. THINK. UNDERSTAND.
        </div>
      </section>
    </div>
    <section class="mt-16 grid gap-7 border-t border-border pt-10 md:grid-cols-3">
      <div
        v-for="(step, index) in [
          {
            title: '課程設定',
            icon: Compass,
            text: '從課程描述出發，整理八欄教學設定。教師確認每個細節。',
          },
          {
            title: '學生探究',
            icon: MessageCircle,
            text: '相同的起點，各自的思考。以提問展開獨立的蘇格拉底對話。',
          },
          {
            title: '全班觀點',
            icon: Layers,
            text: '從個人報告看見觀點分布，審閱後分享，開啟全班討論。',
          },
        ]"
        :key="step.title"
      >
        <div class="mb-4 flex items-center gap-3">
          <span class="text-[10px] text-muted-foreground">0{{ index + 1 }}</span
          ><component :is="step.icon" class="size-4 text-muted-foreground" />
          <h2 class="text-sm font-bold">{{ t(step.title) }}</h2>
        </div>
        <p class="pl-7 text-xs leading-7 text-muted-foreground">{{ step.text }}</p>
      </div>
    </section>
    <section
      v-if="demo"
      class="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 px-6 py-5"
    >
      <div>
        <p class="text-xs font-medium">示範模式</p>
        <p class="mt-1 text-[11px] leading-6 text-muted-foreground">
          使用示範帳號體驗完整流程，資料僅儲存在此瀏覽器。
        </p>
        <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button variant="outline" :disabled="signingIn" @click="enterDemo('wang')"
          ><GraduationCap class="size-4" />教師體驗</Button
        ><Button variant="outline" :disabled="signingIn" @click="enterDemo('s012')"
          ><Users class="size-4" />學生體驗</Button
        ><Button variant="outline" :disabled="signingIn" @click="enterDemo('ta')">助教體驗</Button>
      </div>
    </section>
  </div>
</template>
