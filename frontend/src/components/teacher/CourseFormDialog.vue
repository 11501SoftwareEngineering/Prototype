<script setup lang="ts">
/**
 * 新增／編輯課程。對應 Figma「AddCourse」（node 266:1436）。
 * 傳入 course 就是編輯模式。
 */
import { reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { teacherApi, teacherKeys, type TeacherCourse } from '@/api/teacher'
import FormDialog from '@/components/common/FormDialog.vue'
import FormField from '@/components/common/FormField.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/utils'

const props = defineProps<{ course?: TeacherCourse | null }>()
const open = defineModel<boolean>('open', { default: false })

const queryClient = useQueryClient()
const form = reactive({ name: '', description: '' })
const nameError = ref('')
const formError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  form.name = props.course?.name ?? ''
  form.description = props.course?.description ?? ''
  nameError.value = ''
  formError.value = ''
})

const mutation = useMutation({
  mutationFn: () => {
    const payload = { name: form.name.trim(), description: form.description.trim() }
    return props.course
      ? teacherApi.updateCourse(props.course.course_id, payload)
      : teacherApi.createCourse(payload)
  },
  onSuccess: () => {
    open.value = false
    void queryClient.invalidateQueries({ queryKey: teacherKeys.courses })
    if (props.course) {
      void queryClient.invalidateQueries({ queryKey: teacherKeys.course(props.course.course_id) })
    }
  },
  onError: (error) => (formError.value = getApiErrorMessage(error, '儲存失敗，請稍後再試')),
})

function handleSubmit() {
  nameError.value = form.name.trim() ? '' : '請輸入課程名稱'
  formError.value = ''
  if (!nameError.value) mutation.mutate()
}
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="course ? '編輯課程' : '新增課程'"
    :submit-text="course ? '儲存' : '新增'"
    :loading="mutation.isPending.value"
    :error="formError"
    @submit="handleSubmit"
  >
    <FormField v-slot="field" label="課程名稱" :error="nameError">
      <Input v-model="form.name" v-bind="field" autocomplete="off" />
    </FormField>
    <FormField v-slot="field" label="課程描述" align-top>
      <Textarea v-model="form.description" v-bind="field" :rows="6" />
    </FormField>
  </FormDialog>
</template>
