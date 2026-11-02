<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  Check,
  ShieldCheck,
  MessageCircle,
  RotateCcw,
  Save,
  LockKeyhole,
} from '@lucide/vue'
import {
  inquiryApi,
  inquiryKeys,
  type InquirySetup,
  type SetupInput,
  type SetupJob,
} from '@/api/inquiry'
import { teacherKeys } from '@/api/teacher'
import InquiryShell from '@/components/inquiry/InquiryShell.vue'
import InquirySteps from '@/components/inquiry/InquirySteps.vue'
import ResearchLibrary from '@/components/inquiry/ResearchLibrary.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { useTeachingCourse } from '@/composables/useTeachingCourse'
import { useLocale } from '@/composables/useLocale'
import { setupFromResearch, type ResearchTopic } from '@/data/researchTopics'
import { setupTextFields, textLength, validateSetup } from '@/lib/inquiry'
import { getApiErrorMessage } from '@/lib/utils'

const route = useRoute(),
  router = useRouter(),
  client = useQueryClient()
const { t } = useLocale()
const courseId = computed(() => String(route.params.courseId ?? ''))
const courseQuery = useTeachingCourse(courseId)
const { isOwner, can } = courseQuery
const topicId = computed(() => String(route.params.topicId ?? ''))
const saved = useQuery({
  queryKey: computed(() => inquiryKeys.detail(topicId.value)),
  queryFn: () => inquiryApi.getSetup(topicId.value),
  enabled: () => !!topicId.value && can('edit_activities'),
  refetchOnWindowFocus: false,
})
const models = useQuery({
  queryKey: inquiryKeys.models,
  queryFn: inquiryApi.getModels,
  enabled: () => can('edit_activities'),
})
const form = reactive<SetupInput>({
  age_band: '16-18',
  max_turns: 10,
  description: '',
  source_language: 'zh-TW',
})
const setup = ref<InquirySetup | null>(null)
const job = ref<SetupJob | null>(null)
const modelId = ref('gpt-6-luna'),
  feedback = ref(''),
  error = ref(''),
  notice = ref('')
watch(
  () => courseQuery.data.value?.default_model_id,
  (model) => {
    if (model && !topicId.value && !setup.value && !job.value) modelId.value = model
  },
  { immediate: true },
)
const libraryOpen = ref(false),
  publishOpen = ref(false)
const locked = computed(
  () =>
    !!topicId.value &&
    (saved.data.value?.status === 'published' ||
      courseQuery.data.value?.topics.some(
        (topic) => topic.topic_id === topicId.value && topic.publication_status !== 'draft',
      )),
)
watch(locked, (value) => {
  if (value) {
    libraryOpen.value = false
    publishOpen.value = false
  }
})
const lastSaved = ref('')
const signature = () => JSON.stringify({ form, setup: setup.value, model: modelId.value })
const dirty = computed(() => !locked.value && !!lastSaved.value && signature() !== lastSaved.value)
const length = computed(() => textLength(form.description))
const canPrepare = computed(() => length.value >= 20 && length.value <= 6000)
const completeFields = computed(() =>
  setup.value ? setupTextFields.filter((field) => setup.value![field].trim()).length + 2 : 0,
)
const labels = {
  topic: '主題',
  core_question: '核心探究問題',
  inquiry_focus: '探究重點',
  background_info: '必要背景資訊',
  exclusions: '排除事項',
  opening_message: '開場訊息',
}
const hints = {
  topic: '讓學生與教師辨識這場探究的名稱。',
  core_question: '學生共同思考的主要問題。',
  inquiry_focus: '希望學生檢視的概念、前提與不同觀點。',
  background_info: '開始探究前需要知道的情境或定義。',
  exclusions: '不納入討論的範圍；沒有可填「未指定」。',
  opening_message: '同一活動、相同語言的學生會看見相同開場。',
}

watch(
  () => saved.data.value,
  (value) => {
    if (!value) return
    setup.value = { ...value.setup }
    form.age_band = value.setup.age_band
    form.max_turns = value.setup.max_turns
    form.source_language = value.source_language
    form.description = value.setup.core_question
    modelId.value = value.model_id
    lastSaved.value = signature()
  },
  { immediate: true },
)
onMounted(() => {
  if (!lastSaved.value) lastSaved.value = signature()
})
function warn(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warn))
onUnmounted(() => window.removeEventListener('beforeunload', warn))
onBeforeRouteLeave(() => !dirty.value || window.confirm('還有未儲存的設定，確定離開嗎？'))

function acceptJob(value: SetupJob) {
  if (locked.value) return
  job.value = value
  if (value.setup) setup.value = { ...value.setup }
  error.value = ''
}
function requireEditable() {
  if (locked.value) throw new Error('活動已發布，無法再修改。')
  if (!can('edit_activities')) throw new Error('老師尚未授予編輯活動的權限。')
}
const prepare = useMutation({
  mutationFn: async () => {
    requireEditable()
    const value = await inquiryApi.prepare(courseId.value, { ...form })
    if (value.setup) return value
    const ready = await inquiryApi.clarify(courseId.value, value.job_id, {})
    return { ...ready, questions: value.questions }
  },
  onSuccess: acceptJob,
  onError: (err) => (error.value = getApiErrorMessage(err)),
})
const refine = useMutation({
  mutationFn: () => {
    requireEditable()
    return job.value
      ? inquiryApi.refine(courseId.value, job.value.job_id, setup.value!, feedback.value)
      : inquiryApi.revise(courseId.value, setup.value!, feedback.value, form.source_language)
  },
  onSuccess: (value) => {
    acceptJob(value)
    feedback.value = ''
  },
  onError: (err) => (error.value = getApiErrorMessage(err)),
})
const opening = useMutation({
  mutationFn: () => {
    requireEditable()
    return inquiryApi.refreshOpening(
      courseId.value,
      setup.value!,
      form.source_language,
      modelId.value,
    )
  },
  onSuccess: (value) => {
    if (locked.value) return
    if (setup.value) setup.value.opening_message = value.opening_message
    error.value = ''
    notice.value = '已更新開場訊息，可以繼續編輯並儲存。'
  },
  onError: (err) => (error.value = getApiErrorMessage(err)),
})
const saving = useMutation({
  mutationFn: (status: 'draft' | 'published') => {
    requireEditable()
    return inquiryApi.saveSetup(courseId.value, {
      topic_id: topicId.value,
      status,
      setup: setup.value!,
      source_language: form.source_language,
      model_id: modelId.value,
      expected_version: saved.data.value?.version,
    })
  },
  onSuccess: async (value) => {
    error.value = ''
    publishOpen.value = false
    lastSaved.value = signature()
    notice.value = t('儲存成功')
    await client.invalidateQueries({ queryKey: teacherKeys.course(courseId.value) })
    await client.invalidateQueries({ queryKey: teacherKeys.courses })
    await client.invalidateQueries({ queryKey: inquiryKeys.detail(value.topic_id) })
    await router.replace({
      name: value.status === 'published' ? 'TeacherTopic' : 'TeacherSetupEdit',
      params: { courseId: courseId.value, topicId: value.topic_id },
    })
  },
  onError: (err) => {
    error.value = getApiErrorMessage(err)
    if (error.value === '活動已發布，無法再修改。') {
      void saved.refetch()
      void courseQuery.refetch()
    }
  },
})
const busy = computed(
  () =>
    prepare.isPending.value ||
    refine.isPending.value ||
    opening.isPending.value ||
    saving.isPending.value,
)
function useTopic(topic: ResearchTopic) {
  if (locked.value) return
  if (
    setup.value &&
    !window.confirm('套用主題會取代目前的八欄內容。年齡層與回合選擇會保留，確定套用嗎？')
  )
    return
  setup.value = setupFromResearch(topic, form.age_band, form.max_turns)
  form.description = `${topic.title}。${topic.question} ${topic.focus}`
  form.source_language = 'zh-TW'
  job.value = null
  error.value = ''
}
function save(status: 'draft' | 'published') {
  if (locked.value) {
    error.value = '活動已發布，無法再修改。'
    return
  }
  if (!can('edit_activities') || (!isOwner.value && status === 'published')) {
    error.value = '老師尚未授予此操作權限。'
    return
  }
  if (!setup.value || !validateSetup(setup.value)) {
    error.value = '請填妥八個欄位，年齡層與回合需為允許的選項。'
    return
  }
  if (status === 'published') publishOpen.value = true
  else saving.mutate(status)
}
</script>

<template>
  <InquiryShell>
    <button
      class="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      @click="router.push({ name: 'TeacherCourse', params: { courseId } })"
    >
      <ArrowLeft class="size-3.5" />{{ t('返回課程') }}
    </button>
    <InquirySteps :active="1" />
    <div class="mb-8">
      <p class="eyebrow mb-2">DESIGN A MEANINGFUL INQUIRY</p>
      <h1 class="workspace-title">{{ t(locked ? '活動設定' : '設定一場有深度的探究') }}</h1>
      <p class="mt-3 text-sm leading-7 text-muted-foreground">
        {{
          t(
            locked
              ? '活動已發布，設定僅供檢視。'
              : '提供課程資訊，讓 AI 協助整理；每一項設定都由你決定。',
          )
        }}
      </p>
    </div>
    <QueryState
      :loading="
        courseQuery.isPending.value ||
        (!!topicId && saved.isPending.value && can('edit_activities'))
      "
      :error="
        courseQuery.error.value ??
        saved.error.value ??
        (!courseQuery.isPending.value && !can('edit_activities')
          ? new Error('老師尚未授予編輯活動的權限。')
          : null)
      "
      @retry="saved.refetch()"
    >
      <div
        v-if="error"
        role="alert"
        class="mb-5 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6 text-destructive"
      >
        {{ error }}
      </div>
      <p v-if="notice" role="status" class="mb-5 text-sm text-chart-1">{{ notice }}</p>
      <p
        v-if="locked"
        role="status"
        class="mb-6 flex items-center gap-2 rounded-xl border border-border bg-workspace p-4 text-sm text-workspace-foreground"
      >
        <LockKeyhole class="size-4 shrink-0" />{{ t('活動已發布，無法再修改。') }}
      </p>
      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <section v-if="!setup && !locked" class="surface-panel p-6 sm:p-8">
            <h2 class="mb-7 flex items-center gap-2 text-base font-bold">
              <span class="mr-1 text-xs text-muted-foreground">01</span>{{ t('基本資訊') }}
            </h2>
            <form @submit.prevent="canPrepare && prepare.mutate()">
              <div class="grid gap-5 sm:grid-cols-2">
                <div>
                  <label for="setup-age" class="field-label">{{ t('學習者年齡層') }}</label
                  ><select id="setup-age" v-model="form.age_band" class="workspace-input">
                    <option value="13-15">{{ t('13–15 歲') }}</option>
                    <option value="16-18">{{ t('16–18 歲') }}</option>
                    <option value="university_plus">{{ t('大學及以上') }}</option>
                  </select>
                </div>
                <div>
                  <label for="setup-language" class="field-label">{{ t('內容語言') }}</label
                  ><select
                    id="setup-language"
                    v-model="form.source_language"
                    class="workspace-input"
                  >
                    <option value="zh-TW">繁體中文</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
              <fieldset class="mt-7">
                <legend class="field-label">{{ t('對話回合上限') }}</legend>
                <div class="grid grid-cols-3 gap-3">
                  <label
                    v-for="(round, index) in [5, 10, 15] as const"
                    :key="round"
                    class="cursor-pointer rounded-lg border p-3 text-center transition-colors"
                    :class="
                      form.max_turns === round
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-border hover:border-primary/60'
                    "
                    ><input
                      v-model="form.max_turns"
                      type="radio"
                      name="max-turns"
                      :value="round"
                      class="sr-only"
                    /><span class="block text-xs">{{ t(['簡短', '標準', '較長'][index]!) }}</span
                    ><span class="mt-2 block text-xl font-medium"
                      >{{ round
                      }}<span class="ml-1 text-[10px] text-muted-foreground">{{
                        t('回合')
                      }}</span></span
                    ></label
                  >
                </div>
              </fieldset>
              <div class="mt-7">
                <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <label for="setup-description" class="text-xs font-medium">{{
                    t('主題／課程描述')
                  }}</label
                  ><button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    @click="libraryOpen = true"
                  >
                    <BookOpen class="size-3.5" />{{ t('瀏覽研究主題')
                    }}<span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">18</span>
                  </button>
                </div>
                <textarea
                  id="setup-description"
                  v-model="form.description"
                  :placeholder="t('描述討論情境、核心問題，以及你希望學生思考的方向。')"
                  rows="7"
                  class="workspace-input resize-y"
                  aria-describedby="description-help description-count"
                />
                <div class="mt-2 flex items-start justify-between gap-4">
                  <p id="description-help" class="text-xs leading-6 text-muted-foreground">
                    {{ t('至少 20 字，最多 6000 字；首尾空白不計。') }}
                  </p>
                  <p
                    id="description-count"
                    class="shrink-0 pt-1 text-[10px] tabular-nums"
                    :class="length > 6000 ? 'text-destructive' : 'text-muted-foreground'"
                    aria-live="polite"
                  >
                    {{ length }} / 6000
                  </p>
                </div>
              </div>
              <div
                class="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
              >
                <p class="max-w-60 text-[11px] leading-6 text-muted-foreground">
                  {{ t('補充檔案功能暫不開放。請以文字描述課程。') }}
                </p>
                <Button type="submit" :disabled="!canPrepare || busy"
                  ><Sparkles class="size-4" />{{
                    t(prepare.isPending.value ? '處理中' : '產生八欄設定')
                  }}<ArrowRight class="size-4"
                /></Button>
              </div>
            </form>
          </section>
          <section v-if="setup" class="surface-panel p-6 sm:p-8">
            <div class="mb-7 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-bold">{{ t(locked ? '已發布設定' : '檢視並確認') }}</h2>
                <p class="mt-2 text-xs leading-6 text-muted-foreground">
                  {{
                    t(
                      locked
                        ? '學生使用此活動的相同設定與開場。'
                        : '八個欄位都可以編輯；發布後活動設定將鎖定。',
                    )
                  }}
                </p>
              </div>
              <span class="status-tag"><Check class="size-3" />{{ completeFields }} / 8</span>
            </div>
            <div class="mb-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label for="review-age" class="field-label">{{ t('學習者年齡層') }}</label
                ><select
                  id="review-age"
                  v-model="setup.age_band"
                  class="workspace-input"
                  :disabled="busy || locked"
                >
                  <option value="13-15">{{ t('13–15 歲') }}</option>
                  <option value="16-18">{{ t('16–18 歲') }}</option>
                  <option value="university_plus">{{ t('大學及以上') }}</option>
                </select>
              </div>
              <div>
                <label for="review-rounds" class="field-label">{{ t('對話回合上限') }}</label
                ><select
                  id="review-rounds"
                  v-model="setup.max_turns"
                  class="workspace-input"
                  :disabled="busy || locked"
                >
                  <option v-for="turn in [5, 10, 15]" :key="turn" :value="turn">
                    {{ turn }} {{ t('回合') }}
                  </option>
                </select>
              </div>
            </div>
            <div v-for="field in setupTextFields" :key="field" class="mb-6">
              <div class="mb-2.5 flex flex-wrap items-center justify-between gap-3">
                <label :for="`field-${field}`" class="text-xs font-medium">{{
                  t(labels[field])
                }}</label
                ><button
                  v-if="field === 'opening_message' && !locked"
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  :disabled="
                    busy ||
                    !setup.topic.trim() ||
                    !setup.core_question.trim() ||
                    !models.data.value?.some((model) => model.id === modelId)
                  "
                  @click="opening.mutate()"
                >
                  <RotateCcw
                    class="size-3.5"
                    :class="{ 'animate-spin': opening.isPending.value }"
                  />{{ t(opening.isPending.value ? '處理中' : '重新產生開場訊息') }}
                </button>
              </div>
              <textarea
                :id="`field-${field}`"
                v-model="setup[field]"
                class="workspace-input resize-y"
                :rows="field === 'topic' ? 2 : field === 'opening_message' ? 4 : 3"
                :disabled="busy || locked"
                required
              />
              <p class="field-help">{{ hints[field] }}</p>
            </div>
            <div class="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
              <div>
                <label for="review-language" class="field-label">{{ t('內容語言') }}</label
                ><select
                  id="review-language"
                  v-model="form.source_language"
                  class="workspace-input"
                  :disabled="busy || locked"
                >
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label for="setup-model" class="field-label">{{ t('模型設定') }}</label
                ><select
                  id="setup-model"
                  v-model="modelId"
                  class="workspace-input"
                  :disabled="locked || busy || models.isPending.value || !!models.error.value"
                >
                  <option
                    v-for="model in models.data.value ?? []"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name }}
                  </option>
                </select>
                <p v-if="models.error.value" class="field-help text-destructive">
                  無法取得模型清單。<button class="underline" @click="models.refetch()">
                    {{ t('重新載入') }}
                  </button>
                </p>
                <p v-else class="field-help">{{ t('同一活動的學生使用相同模型。') }}</p>
              </div>
            </div>
            <div v-if="!locked" class="mt-7 rounded-xl bg-muted/60 p-5">
              <label for="setup-feedback" class="field-label">{{
                t('給 AI 的回饋／釐清回答')
              }}</label>
              <ol
                v-if="job?.questions.length"
                class="mb-4 space-y-2 text-xs leading-6 text-muted-foreground"
              >
                <li v-for="(question, index) in job.questions" :key="question.id">
                  {{ index + 1 }}. {{ question.text }}
                </li>
              </ol>
              <textarea
                id="setup-feedback"
                v-model="feedback"
                rows="3"
                :disabled="busy"
                class="workspace-input bg-card"
                :placeholder="t('告訴 AI 你希望如何調整，或直接編輯上方欄位。')"
              /><Button
                variant="outline"
                class="mt-3"
                :disabled="!feedback.trim() || busy"
                @click="refine.mutate()"
                ><RotateCcw class="size-3.5" />{{ t('依回饋重新產生') }}</Button
              >
            </div>
            <div
              v-if="!locked"
              class="mt-7 flex flex-wrap justify-end gap-3 border-t border-border pt-6"
            >
              <Button variant="outline" :disabled="busy" @click="save('draft')"
                ><Save class="size-4" />{{
                  isOwner ? t('儲存草稿') : '儲存草稿，交由老師發布'
                }}</Button
              ><Button
                v-if="isOwner"
                :disabled="
                  !validateSetup(setup) ||
                  busy ||
                  !models.data.value?.some((model) => model.id === modelId)
                "
                @click="save('published')"
                >{{ t('確認並發布活動') }}<ArrowRight class="size-4"
              /></Button>
            </div>
          </section>
        </div>
        <aside class="space-y-5 xl:sticky xl:top-6">
          <section v-if="setup" class="surface-panel p-5">
            <p class="mb-4 flex items-center gap-2 text-xs font-medium">
              <MessageCircle class="size-4 text-muted-foreground" />{{ t('預覽開場') }}
            </p>
            <p class="rounded-lg bg-muted/60 px-4 py-4 text-sm leading-8">
              {{ setup.opening_message }}
            </p>
            <p class="mt-4 text-[11px] text-muted-foreground">
              {{ t(locked ? '已發布' : '待教師確認') }} · {{ t('已填寫') }} {{ completeFields }}/8
            </p>
          </section>
          <section class="surface-panel p-5">
            <ShieldCheck class="mb-4 size-5 text-chart-1" />
            <h2 class="text-sm font-bold">{{ t('教學提醒') }}</h2>
            <ul class="mt-4 space-y-4 text-xs leading-7 text-muted-foreground">
              <li>{{ t('每一位學生都有獨立對話脈絡。') }}</li>
              <li>{{ t('開場訊息是第一回合的起點。') }}</li>
              <li>{{ t('不預設正確立場，也不預先設定結論類別。') }}</li>
            </ul>
          </section>
          <section v-if="job?.checks.length" class="px-2">
            <h2 class="mb-4 text-xs font-medium">{{ t('課程檢查') }}</h2>
            <ul class="space-y-3">
              <li
                v-for="check in job.checks"
                :key="check.field"
                class="flex items-start gap-2 text-xs leading-6 text-muted-foreground"
              >
                <Check class="mt-1 size-3.5 shrink-0 text-chart-1" /><span
                  >{{ t(labels[check.field as keyof typeof labels] ?? check.field) }} ·
                  {{ t('待教師確認') }}</span
                >
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </QueryState>
    <ResearchLibrary v-model:open="libraryOpen" @select="useTopic" />
    <ConfirmDialog
      v-model:open="publishOpen"
      :title="t('確認並發布活動')"
      description="確認八欄、內容語言與模型後，學生即可開始探究；發布後無法修改活動設定。"
      :confirm-text="t('確認並發布活動')"
      :loading="saving.isPending.value"
      :error="error"
      @confirm="saving.mutate('published')"
    />
  </InquiryShell>
</template>
