import { http, HttpResponse, delay } from 'msw'
import { db, syncDbFromStorage, type DbEnrollment } from './db'
import { scenarios } from './scenarios'
import { TA_PERMISSIONS, type TaPermission } from '@/api/ta'
const base = '*/api/v1/teacher/courses/:courseId/tas'
const fail = (status: number, detail: string) => HttpResponse.json({ detail }, { status })
function owner(request: Request, courseId: string) {
  syncDbFromStorage()
  const id = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+mock-token\./, '')
  const user = db.users.find((item) => item.id === id)
  if (!user) return fail(401, 'Not authenticated or token expired')
  if (user.must_change_password) return fail(403, 'Password change required')
  if (user.role !== 'TEACHER') return fail(403, '只有課程老師可以管理助教。')
  if (!db.courses.some((course) => course.id === courseId && course.teacher_id === user.id))
    return fail(404, 'Course not found')
  return user
}
function validPermissions(value: unknown): value is TaPermission[] {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((key) => TA_PERMISSIONS.some((permission) => permission.key === key))
  )
}
function profile(member: DbEnrollment) {
  const user = db.users.find((item) => item.id === member.student_id)!
  return {
    student_id: user.id,
    account: user.account,
    name: user.name,
    permissions: member.permissions ?? [],
  }
}
export const taHandlers = [
  http.get(base, async ({ request, params }) => {
    const user = owner(request, String(params.courseId))
    if (user instanceof Response) return user
    await delay(scenarios.latency)
    return HttpResponse.json(
      db.enrollments
        .filter((item) => item.course_id === params.courseId && item.role === 'TA')
        .map(profile),
    )
  }),
  http.post(base, async ({ request, params }) => {
    const user = owner(request, String(params.courseId))
    if (user instanceof Response) return user
    const data = (await request.json()) as { account: string; permissions: unknown }
    if (!validPermissions(data.permissions)) return fail(422, '請使用允許的助教權限。')
    const assistant = db.users.find(
      (item) => item.account === data.account?.trim() && item.role === 'USER',
    )
    if (!assistant) return fail(404, '找不到此學生或助教帳號，請先註冊帳號。')
    let member = db.enrollments.find(
      (item) => item.course_id === params.courseId && item.student_id === assistant.id,
    )
    if (member?.role === 'TA') return fail(409, '此帳號已是課程助教，請直接修改下方權限。')
    if (member) {
      member.previous_student = true
      member.role = 'TA'
      member.permissions = [...data.permissions]
    } else {
      member = {
        course_id: String(params.courseId),
        student_id: assistant.id,
        role: 'TA',
        permissions: [...data.permissions],
        joined_at: new Date().toISOString(),
      }
      db.enrollments.push(member)
    }
    return HttpResponse.json(profile(member), { status: 201 })
  }),
  http.patch(`${base}/:memberId`, async ({ request, params }) => {
    const user = owner(request, String(params.courseId))
    if (user instanceof Response) return user
    const member = db.enrollments.find(
      (item) =>
        item.course_id === params.courseId &&
        item.student_id === params.memberId &&
        item.role === 'TA',
    )
    if (!member) return fail(404, '找不到課程助教。')
    const { permissions } = (await request.json()) as { permissions: unknown }
    if (!validPermissions(permissions)) return fail(422, '請使用允許的助教權限。')
    member.permissions = [...permissions]
    return HttpResponse.json(profile(member))
  }),
  http.delete(`${base}/:memberId`, async ({ request, params }) => {
    const user = owner(request, String(params.courseId))
    if (user instanceof Response) return user
    const member = db.enrollments.find(
      (item) =>
        item.course_id === params.courseId &&
        item.student_id === params.memberId &&
        item.role === 'TA',
    )
    if (!member) return fail(404, '找不到課程助教。')
    if (member.previous_student) {
      member.role = 'STUDENT'
      member.permissions = []
      member.previous_student = false
    } else db.enrollments = db.enrollments.filter((item) => item !== member)
    return HttpResponse.json({ message: '已移除助教資格，原有學生紀錄保留。' })
  }),
]
