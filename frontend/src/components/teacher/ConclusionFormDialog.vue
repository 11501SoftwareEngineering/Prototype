<script setup lang="ts">
/**
 * 新增結論。對應 Figma「AddResult」（node 266:2256）。
 * API：POST /teacher/topics/{topicId}/conclusions
 */
import { reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { teacherApi, teacherKeys } from '@/api/teacher'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/utils'

const props = defineProps<{ topicId: string }>()
const open = defineModel<boolean>('open', { default: false })

const queryClient = useQueryClient()
const form = reactive({ title: '', description: '' })
const titleError = ref('')
const formError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, { title: '', description: '' })
  titleError.value = ''
  formError.value = ''
})

const mutation = useMutation({
  mutationFn: () =>
    teacherApi.createConclusion(props.topicId, {
      title: form.title.trim(),
      description: form.description.trim(),
    }),
  onSuccess: () => {
    open.value = false
    void queryClient.invalidateQueries({ queryKey: teacherKeys.conclusions(props.topicId) })
  },
  onError: (error) => (formError.value = getApiErrorMessage(error, '新增失敗，請稍後再試')),
})

function handleSubmit() {
  titleError.value = form.title.trim() ? '' : '請輸入結論名稱'
  formError.value = ''
  if (!titleError.value) mutation.mutate()
}
</script>

<template>
  <FormDialog
    v-model:open="open"
    title="新增結論"
    :loading="mutation.isPending.value"
    :error="formError"
    @submit="handleSubmit"
  >
    <FormField v-slot="field" label="結論名稱" :error="titleError">
      <Input v-model="form.title" v-bind="field" autocomplete="off" />
    </FormField>
    <FormField v-slot="field" label="結論描述" align-top>
      <Textarea v-model="form.description" v-bind="field" :rows="6" />
    </FormField>
  </FormDialog>
</template>
