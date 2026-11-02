<script setup lang="ts">
/**
 * 新增／編輯問題。對應 Figma「AddQuistion」（node 266:2276）。
 * 年齡層、回合數是 Figma 上的選項（規格還沒定義欄位，見 api/teacher.ts）。
 */
import { reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  AGE_RANGES,
  ROUND_OPTIONS,
  teacherApi,
  teacherKeys,
  type TeacherTopic,
} from '@/api/teacher'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import OptionGroup from '@/components/common/OptionGroup.vue'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/utils'

const props = defineProps<{ courseId: string; topic?: TeacherTopic | null }>()
const open = defineModel<boolean>('open', { default: false })

const queryClient = useQueryClient()
const form = reactive({ title: '', ageRange: '13-15', maxRounds: 10 })
const titleError = ref('')
const formError = ref('')

const ageOptions = AGE_RANGES.map((value) => ({ value: value as string, label: value }))
const roundOptions = ROUND_OPTIONS.map((o) => ({
  value: o.value as number,
  label: `${o.label}(${o.value})`,
}))

watch(open, (isOpen) => {
  if (!isOpen) return
  form.title = props.topic?.title ?? ''
  form.ageRange = props.topic?.age_range ?? '13-15'
  form.maxRounds = props.topic?.max_rounds ?? 10
  titleError.value = ''
  formError.value = ''
})

const mutation = useMutation({
  mutationFn: () => {
    const payload = {
      course_id: props.courseId,
      title: form.title.trim(),
      description: props.topic?.description ?? '',
      age_range: form.ageRange,
      max_rounds: form.maxRounds,
    }
    return props.topic
      ? teacherApi.updateTopic(props.topic.topic_id, payload)
      : teacherApi.createTopic(payload)
  },
  onSuccess: () => {
    open.value = false
    void queryClient.invalidateQueries({ queryKey: teacherKeys.course(props.courseId) })
    void queryClient.invalidateQueries({ queryKey: teacherKeys.courses })
  },
  onError: (error) => (formError.value = getApiErrorMessage(error, '儲存失敗，請稍後再試')),
})

function handleSubmit() {
  titleError.value = form.title.trim() ? '' : '請輸入問題'
  formError.value = ''
  if (!titleError.value) mutation.mutate()
}
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="topic ? '編輯問題' : '新增問題'"
    :submit-text="topic ? '儲存' : '新增'"
    :loading="mutation.isPending.value"
    :error="formError"
    @submit="handleSubmit"
  >
    <FormField v-slot="field" label="輸入問題" align-top :error="titleError">
      <Textarea
        v-model="form.title"
        v-bind="field"
        :rows="4"
        placeholder="例如：善意的謊言是對的嗎？"
      />
    </FormField>
    <OptionGroup v-model="form.ageRange" label="年齡層" :options="ageOptions" />
    <OptionGroup v-model="form.maxRounds" label="回合數" :options="roundOptions" />
  </FormDialog>
</template>
