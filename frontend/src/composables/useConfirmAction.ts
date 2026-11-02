import { reactive, ref, shallowRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { getApiErrorMessage } from '@/lib/utils'

/**
 * 「先問一次再執行」的操作（刪除、退出課程…），搭配 <ConfirmDialog> 使用。
 *
 *   const remove = useConfirmAction((course: TeacherCourse) => teacherApi.deleteCourse(course.course_id), {
 *     onSuccess: () => queryClient.invalidateQueries(...),
 *   })
 *
 *   <Button @click="remove.ask(course)">刪除</Button>
 *   <ConfirmDialog v-model:open="remove.open" :loading="remove.isPending"
 *     :error="remove.error" @confirm="remove.confirm()" … />
 *
 * 回傳的是 reactive 物件，template 裡不用加 .value。
 */
export function useConfirmAction<T>(
  action: (target: T) => Promise<unknown>,
  options: { onSuccess?: (target: T) => unknown; errorText?: string } = {},
) {
  const open = ref(false)
  const target = shallowRef<T | null>(null)
  const error = ref('')

  const mutation = useMutation({
    mutationFn: (item: T) => action(item),
    onSuccess: async (_data, item) => {
      open.value = false
      await options.onSuccess?.(item)
    },
    onError: (err) => {
      error.value = getApiErrorMessage(err, options.errorText ?? '操作失敗，請稍後再試')
    },
  })

  function ask(item: T) {
    target.value = item
    error.value = ''
    open.value = true
  }

  function confirm() {
    if (target.value !== null) mutation.mutate(target.value)
  }

  return reactive({ open, target, error, isPending: mutation.isPending, ask, confirm })
}
