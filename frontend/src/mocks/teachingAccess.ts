import { HttpResponse } from 'msw'
import { db, type DbUser } from './db'
import { DEFAULT_TA_PERMISSIONS, type TaPermission, type TeachingAccess } from '@/api/ta'
const denied = () =>
  HttpResponse.json({ detail: '老師尚未授予此操作權限，或助教資格已移除。' }, { status: 403 })
export function teachingAccess(user: DbUser, courseId: string): TeachingAccess | null {
  const course = db.courses.find((item) => item.id === courseId)
  if (!course) return null
  if (user.role === 'TEACHER' && course.teacher_id === user.id)
    return { role: 'TEACHER', permissions: [...DEFAULT_TA_PERMISSIONS] }
  if (user.role !== 'USER') return null
  const member = db.enrollments.find(
    (item) => item.course_id === courseId && item.student_id === user.id && item.role === 'TA',
  )
  return member ? { role: 'TA', permissions: member.permissions ?? [] } : null
}
export function teachingDenial(request: Request, user: DbUser): Response | null {
  if (user.role === 'TEACHER') return null
  if (user.role !== 'USER') return denied()
  const path = new URL(request.url).pathname.replace(/^\/api\/v1/, '')
  const hasAssignment = db.enrollments.some(
    (item) =>
      item.student_id === user.id &&
      item.role === 'TA' &&
      db.courses.some((course) => course.id === item.course_id),
  )
  if (!hasAssignment)
    return HttpResponse.json({ detail: 'Teacher privileges required' }, { status: 403 })
  if (request.method === 'GET' && ['/teacher/courses', '/teacher/inquiry-models'].includes(path))
    return null
  const courseId =
    path.match(/^\/teacher\/courses\/([^/]+)/)?.[1] ??
    db.topics.find((item) => item.id === path.match(/^\/teacher\/topics\/([^/]+)/)?.[1])?.course_id
  if (!courseId) return denied()
  const access = teachingAccess(user, decodeURIComponent(courseId))
  if (!access || access.role !== 'TA') return denied()
  let permission: TaPermission | null = null
  if (request.method === 'GET' && /^\/teacher\/courses\/[^/]+\/topics$/.test(path)) return null
  if (request.method === 'GET' && /^\/teacher\/topics\/[^/]+\/(setup|summary)$/.test(path))
    return null
  if (request.method === 'GET' && path.endsWith('/students')) permission = 'view_members'
  else if (request.method === 'GET' && path.endsWith('/reports')) permission = 'view_reports'
  else if (
    ['POST', 'PATCH'].includes(request.method) &&
    /^\/teacher\/topics\/[^/]+\/summary$/.test(path)
  )
    permission = 'edit_summary'
  else if (
    request.method === 'POST' &&
    /^\/teacher\/courses\/[^/]+\/(setup-jobs(?:\/[^/]+\/(?:answers|refine))?|setup-revisions|opening-message|inquiries)$/.test(
      path,
    )
  )
    permission = 'edit_activities'
  return permission && access.permissions.includes(permission) ? null : denied()
}
