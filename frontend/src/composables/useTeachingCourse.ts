import { computed, type MaybeRefOrGetter } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTeacherCourse } from './useCourseDetail'
import type { TaPermission } from '@/api/ta'
export function useTeachingCourse(courseId: MaybeRefOrGetter<string>) {
  const query = useTeacherCourse(courseId)
  const auth = useAuthStore()
  const isOwner = computed(() => auth.userRole === 'TEACHER')
  const can = (permission: TaPermission) =>
    isOwner.value ||
    (!query.isError.value && !!query.data.value?.access?.permissions.includes(permission))
  return { ...query, isOwner, can }
}
