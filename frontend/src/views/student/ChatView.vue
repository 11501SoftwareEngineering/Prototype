<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Send,
  Mic,
  Square,
  ShieldCheck,
  Check,
  BookOpen,
  Volume2,
  VolumeX,
} from '@lucide/vue'
import { studentApi, studentKeys, type ChatMessage, type SessionMessages } from '@/api/student'
import { inquiryApi } from '@/api/inquiry'
import InquirySteps from '@/components/inquiry/InquirySteps.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { useChatStream } from '@/composables/useChatStream'
import { useStudentCourse } from '@/composables/useCourseDetail'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useLocale } from '@/composables/useLocale'
import { getApiErrorMessage } from '@/lib/utils'

interface DisplayMessage extends ChatMessage {
  pending?: boolean
}
const route = useRoute(),
  router = useRouter(),
  client = useQueryClient(),
  { t } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? '')),
  topicId = computed(() => String(route.params.topicId ?? ''))
const { data: course } = useStudentCourse(courseId)
const topic = computed(() => course.value?.topics.find((item) => item.topic_id === topicId.value))
const sessionQuery = useQuery({
  queryKey: computed(() => ['student', 'topic', topicId.value, 'session']),
  queryFn: () => studentApi.createSession(topicId.value),
  staleTime: Infinity,
  retry: false,
})
const sessionId = computed(() => sessionQuery.data.value?.session_id ?? '')
const messagesQuery = useQuery({
  queryKey: computed(() => studentKeys.messages(sessionId.value)),
  queryFn: () => studentApi.getSessionMessages(sessionId.value),
  enabled: () => !!sessionId.value,
  retry: false,
  refetchOnWindowFocus: false,
})
const explanation = useQuery({
  queryKey: computed(() => ['student', 'topic', topicId.value, 'explanation']),
  queryFn: () => studentApi.getTopicExplanation(topicId.value),
})
const messages = ref<DisplayMessage[]>([]),
  remaining = ref(0),
  total = ref(0),
  completed = ref(false),
  awaitingConsent = ref(false)
const draft = ref(''),
  sendError = ref(''),
  abandonOpen = ref(false),
  speaking = ref('')
const viewport = useTemplateRef<HTMLElement>('viewport')
let pendingRequest: { id: string; text: string; priorReplies: number } | null = null
const isSending = ref(false),
  needsReload = ref(false)
let active = true
const { isStreaming, streamMessage } = useChatStream()
function adopt(data: SessionMessages) {
  messages.value = data.messages.map((message) => ({ ...message }))
  remaining.value = data.remaining_rounds
  total.value = data.max_rounds
  completed.value = data.status === 'COMPLETED'
  awaitingConsent.value = !!data.awaiting_end_consent
}
watch(
  () => messagesQuery.data.value,
  (data) => {
    if (data && !isSending.value) adopt(data)
  },
  { immediate: true },
)
const loading = computed(() => sessionQuery.isPending.value || messagesQuery.isPending.value)
const loadError = computed(() => sessionQuery.error.value ?? messagesQuery.error.value)
function retryLoad() {
  if (sessionQuery.isError.value) void sessionQuery.refetch()
  else void messagesQuery.refetch()
}
function scrollDown() {
  void nextTick(() =>
    viewport.value?.scrollTo({ top: viewport.value.scrollHeight, behavior: 'smooth' }),
  )
}
watch(() => messages.value.length, scrollDown)
async function restore() {
  const data = await studentApi.getSessionMessages(sessionId.value)
  adopt(data)
  client.setQueryData(studentKeys.messages(sessionId.value), data)
  return data
}
async function handleSend(text = draft.value) {
  text = text.trim()
  if (
    !text ||
    !sessionId.value ||
    isStreaming.value ||
    isSending.value ||
    needsReload.value ||
    completed.value ||
    awaitingConsent.value ||
    remaining.value <= 0
  )
    return
  if (!pendingRequest || pendingRequest.text !== text)
    pendingRequest = {
      id: crypto.randomUUID(),
      text,
      priorReplies: messages.value.filter((message) => message.role === 'user').length,
    }
  const request = pendingRequest
  let confirmed = false
  isSending.value = true
  sendError.value = ''
  draft.value = ''
  messages.value.push({ message_id: `local-${request.id}`, role: 'user', content: text })
  const replyId = `reply-${request.id}`
  messages.value.push({ message_id: replyId, role: 'assistant', content: '', pending: true })
  try {
    await streamMessage(
      sessionId.value,
      text,
      {
        onChunk: (chunk) => {
          const reply = messages.value.find((message) => message.message_id === replyId)
          if (reply) {
            reply.pending = false
            reply.content += chunk
          }
          scrollDown()
        },
        onDone: (done) => {
          confirmed = true
          remaining.value = done.remaining_rounds
          completed.value = done.is_completed
          awaitingConsent.value = !!done.awaiting_end_consent
        },
      },
      request.id,
    )
    if (!active) return
    pendingRequest = null
    await restore()
    if (completed.value)
      await client.invalidateQueries({ queryKey: studentKeys.course(courseId.value) })
  } catch (err) {
    if (!active) return
    if (confirmed) {
      pendingRequest = null
      needsReload.value = true
      messages.value = messages.value.filter(
        (message) => message.message_id !== replyId || !!message.content,
      )
      sendError.value = '回答已儲存，暫時無法取得完整紀錄。請重新載入對話後再繼續。'
      return
    }
    sendError.value = getApiErrorMessage(err, '回應未完成，正在確認已保存的對話。')
    try {
      const data = await restore()
      const replies = data.messages.filter((message) => message.role === 'user')
      const saved =
        replies.length > request.priorReplies && replies[request.priorReplies]?.content === text
      if (saved) {
        pendingRequest = null
        sendError.value = '已恢復保存的對話。回合數以已保存的回答為準。'
      } else draft.value = text
    } catch {
      needsReload.value = true
      draft.value = text
      messages.value = messages.value.filter(
        (message) => message.message_id !== replyId && message.message_id !== `local-${request.id}`,
      )
    }
  } finally {
    isSending.value = false
  }
}
async function recover() {
  if (isSending.value) return
  isSending.value = true
  try {
    const data = await restore()
    const replies = data.messages.filter((message) => message.role === 'user')
    if (
      pendingRequest &&
      replies.length > pendingRequest.priorReplies &&
      replies[pendingRequest.priorReplies]?.content === pendingRequest.text
    ) {
      pendingRequest = null
      draft.value = ''
    }
    needsReload.value = false
    sendError.value = ''
  } catch (err) {
    sendError.value = getApiErrorMessage(err)
  } finally {
    isSending.value = false
  }
}
const ending = useMutation({
  mutationFn: (action: 'complete' | 'continue' | 'abandon') =>
    inquiryApi.endSession(sessionId.value, action),
  onSuccess: async (_, action) => {
    abandonOpen.value = false
    if (action === 'abandon') {
      await client.invalidateQueries({ queryKey: ['student'] })
      await router.push({ name: 'StudentCourse', params: { courseId: courseId.value } })
    } else {
      await restore()
      await client.invalidateQueries({ queryKey: studentKeys.course(courseId.value) })
    }
  },
  onError: (err) => (sendError.value = getApiErrorMessage(err)),
})
const voice = useVoiceRecorder()
async function handleMic() {
  try {
    const text = await voice.toggleRecording()
    if (text) draft.value = draft.value ? `${draft.value} ${text}` : text
  } catch {
    /* The recorder exposes its accessible error state. */
  }
}
function speak(message: DisplayMessage) {
  if (!('speechSynthesis' in window)) {
    sendError.value = '此瀏覽器不支援語音朗讀，仍可閱讀完整文字。'
    return
  }
  window.speechSynthesis.cancel()
  if (speaking.value === message.message_id) {
    speaking.value = ''
    return
  }
  const utterance = new SpeechSynthesisUtterance(message.content)
  utterance.lang = topic.value?.content_language ?? 'zh-TW'
  utterance.onend = () => (speaking.value = '')
  utterance.onerror = () => (speaking.value = '')
  speaking.value = message.message_id
  window.speechSynthesis.speak(utterance)
}
onUnmounted(() => {
  active = false
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
})
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
    <RouterLink
      :to="{ name: 'StudentCourse', params: { courseId } }"
      class="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
      ><ArrowLeft class="size-3.5" />{{ t('返回課程') }}</RouterLink
    ><InquirySteps :active="2" />
    <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow mb-2">YOUR SPACE TO THINK</p>
        <h1 class="workspace-title">{{ topic?.title ?? t('學生探究') }}</h1>
        <p class="mt-3 text-sm text-muted-foreground">
          {{ t('這裡沒有標準答案，試著說清楚你的理由。') }}
        </p>
      </div>
      <span v-if="total" class="status-tag" aria-live="polite"
        >{{ t('已完成回合') }} {{ total - remaining }} / {{ total }}</span
      >
    </div>
    <QueryState :loading="loading" :error="loadError" @retry="retryLoad">
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_245px]">
        <section class="surface-panel overflow-hidden">
          <div class="flex items-center gap-3 border-b border-border px-5 py-4">
            <span class="flex size-8 items-center justify-center rounded-full bg-primary/15"
              ><MessageCircle class="size-4"
            /></span>
            <div>
              <h2 class="text-xs font-medium">{{ t('蘇格拉底') }}</h2>
              <p class="mt-1 text-[10px] text-muted-foreground">
                {{ completed ? t('對話完成') : t('進行中') }}
              </p>
            </div>
            <span class="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground"
              ><ShieldCheck class="size-3.5 text-chart-1" />{{
                t('每一位學生都有獨立對話脈絡。')
              }}</span
            >
          </div>
          <div
            ref="viewport"
            class="max-h-[55vh] min-h-72 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7"
          >
            <ol
              class="space-y-7"
              aria-label="對話紀錄"
              aria-live="polite"
              aria-relevant="additions"
            >
              <li
                v-for="message in messages"
                :key="message.message_id"
                class="flex"
                :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div class="max-w-[90%] sm:max-w-[85%]">
                  <p
                    class="mb-2 text-[10px] text-muted-foreground"
                    :class="{ 'text-right': message.role === 'user' }"
                  >
                    {{ t(message.role === 'user' ? '你' : '蘇格拉底') }}
                  </p>
                  <div
                    class="whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-8"
                    :class="
                      message.role === 'user'
                        ? 'rounded-tr-sm border border-border bg-workspace text-workspace-foreground'
                        : 'rounded-tl-sm bg-muted/70'
                    "
                  >
                    <span
                      v-if="message.pending && !message.content"
                      role="status"
                      class="animate-pulse"
                      >•••</span
                    >{{ message.content }}
                  </div>
                  <button
                    v-if="message.role === 'assistant' && message.content && !message.pending"
                    class="mt-2 rounded p-1 text-muted-foreground/70 hover:text-foreground"
                    :aria-label="speaking === message.message_id ? '停止朗讀' : '朗讀訊息'"
                    @click="speak(message)"
                  >
                    <VolumeX v-if="speaking === message.message_id" class="size-3.5" /><Volume2
                      v-else
                      class="size-3.5"
                    />
                  </button>
                </div>
              </li>
            </ol>
          </div>
          <div
            v-if="sendError || voice.errorMessage.value"
            role="alert"
            class="border-t border-border px-5 py-3 text-xs leading-6 text-destructive"
          >
            {{ sendError || voice.errorMessage.value }}
            <button v-if="sendError" class="ml-2 underline" @click="recover()">
              {{ t('重新載入') }}
            </button>
          </div>
          <div v-if="completed" class="border-t border-border bg-primary/5 p-6">
            <div class="mb-3 flex items-center gap-2 text-chart-1">
              <Check class="size-4" /><span class="text-xs font-medium">{{ t('對話完成') }}</span>
            </div>
            <h2 class="text-base font-bold">{{ t('你的想法，值得再回顧一次。') }}</h2>
            <p class="mt-2 text-xs leading-7 text-muted-foreground">
              {{ t('本次探究已完成，個人報告會整理你的觀點、理由與轉折。') }}
            </p>
            <Button as-child class="mt-5"
              ><RouterLink :to="{ name: 'StudentResult', params: { courseId, sessionId } }"
                >{{ t('查看個人報告') }}<ArrowRight class="size-4" /></RouterLink
            ></Button>
          </div>
          <div v-else-if="awaitingConsent" class="border-t border-border bg-primary/5 p-6">
            <p class="mb-5 text-sm leading-7">{{ t('已達成本次探究目標，要在這裡收束嗎？') }}</p>
            <div class="flex flex-wrap gap-3">
              <Button :disabled="ending.isPending.value" @click="ending.mutate('complete')"
                >{{ t('同意結束') }}<Check class="size-4" /></Button
              ><Button
                variant="outline"
                :disabled="ending.isPending.value"
                @click="ending.mutate('continue')"
                >{{ t('繼續思考') }}</Button
              >
            </div>
          </div>
          <form v-else class="border-t border-border p-5" @submit.prevent="handleSend()">
            <label for="student-reply" class="sr-only">{{ t('你的回覆') }}</label
            ><textarea
              id="student-reply"
              v-model="draft"
              rows="3"
              maxlength="6000"
              class="w-full resize-y bg-transparent text-sm leading-7 outline-none"
              :placeholder="t('寫下你的想法與理由…')"
              :disabled="needsReload || isSending || ending.isPending.value"
              @keydown.ctrl.enter.prevent="!$event.isComposing && handleSend()"
              @keydown.meta.enter.prevent="!$event.isComposing && handleSend()"
            />
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
                  :aria-label="voice.isRecording.value ? '停止錄音' : t('語音輸入')"
                  :disabled="needsReload || isSending || voice.isTranscribing.value"
                  @click="handleMic"
                >
                  <Square v-if="voice.isRecording.value" class="size-4 text-destructive" /><Mic
                    v-else
                    class="size-4"
                  /></button
                ><button
                  type="button"
                  class="text-[11px] text-muted-foreground underline-offset-4 hover:underline disabled:opacity-40"
                  :disabled="
                    needsReload ||
                    isSending ||
                    voice.isRecording.value ||
                    voice.isTranscribing.value
                  "
                  @click="handleSend('略過這一題')"
                >
                  {{ t('略過這題') }}
                </button>
              </div>
              <Button
                type="submit"
                :disabled="
                  !draft.trim() ||
                  needsReload ||
                  isSending ||
                  voice.isRecording.value ||
                  voice.isTranscribing.value ||
                  remaining <= 0
                "
                >{{ t(isSending ? '處理中' : '送出') }}<Send class="size-3.5"
              /></Button>
            </div>
            <p class="mt-3 text-[10px] leading-6 text-muted-foreground">
              Ctrl / ⌘ + Enter · 回答成功儲存後完成一回合；已完成 {{ total - remaining }} /
              {{ total }}。
            </p>
          </form>
        </section>
        <aside class="space-y-5">
          <section class="surface-panel p-5">
            <h2 class="mb-4 flex items-center gap-2 text-xs font-medium">
              <BookOpen class="size-4 text-muted-foreground" />{{ t('探究背景') }}
            </h2>
            <p v-if="explanation.data.value" class="text-xs leading-8 text-muted-foreground">
              {{ explanation.data.value.background }}
            </p>
            <p v-else-if="explanation.isPending.value" class="text-xs text-muted-foreground">
              {{ t('處理中') }}
            </p>
            <button v-else class="text-xs underline" @click="explanation.refetch()">
              {{ t('重新載入') }}
            </button>
          </section>
          <div class="px-2 text-[11px] leading-7 text-muted-foreground">
            <p>{{ t('開場訊息是第一回合的起點。') }}</p>
            <p class="mt-3">達到回合上限後自動收束；目標達成時，你可以選擇提前結束。</p>
            <button
              v-if="!completed"
              class="mt-6 text-muted-foreground underline underline-offset-4"
              :disabled="needsReload || isSending || ending.isPending.value"
              @click="abandonOpen = true"
            >
              {{ t('退出探究') }}
            </button>
          </div>
        </aside>
      </div>
    </QueryState>
    <ConfirmDialog
      v-model:open="abandonOpen"
      :title="t('退出探究')"
      description="退出會保留已儲存紀錄，但不算正式完成，也不會納入全班觀點摘要。暫時離開頁面可在稍後恢復對話。"
      :confirm-text="t('退出探究')"
      :loading="ending.isPending.value"
      :error="sendError"
      @confirm="ending.mutate('abandon')"
    />
  </div>
</template>
