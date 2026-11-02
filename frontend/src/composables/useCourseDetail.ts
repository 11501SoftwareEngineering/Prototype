import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { studentApi, studentKeys } from '@/api/student'
import { useAuthStore } from '@/stores/auth'
import { teacherApi, teacherKeys } from '@/api/teacher'

/**
 * 課程資訊＋問題列表。頁面和 Header（顯示課程名稱）共用同一份快取，只會打一次 API。
 */
export function useStudentCourse(courseId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(courseId))
  return useQuery({
    queryKey: computed(() => studentKeys.course(id.value)),
    enabled: () => Boolean(id.value),
    queryFn: ({ signal }) => studentApi.getCourseTopics(id.value, signal),
    retry: false,
  })
}

export function useTeacherCourse(courseId: MaybeRefOrGetter<string>) {
  const auth = useAuthStore()
  const id = computed(() => toValue(courseId))
  return useQuery({
    queryKey: computed(() => teacherKeys.course(id.value)),
    enabled: () => Boolean(id.value),
    queryFn: () => teacherApi.getCourseTopics(id.value),
    refetchInterval: () => (auth.user?.has_ta_assignments ? 15000 : false),
    retry: false,
  })
}
