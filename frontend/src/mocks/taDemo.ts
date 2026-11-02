import type { Db } from './db'
import { DEFAULT_TA_PERMISSIONS } from '@/api/ta'
export function installTaDemo(state: Db) {
  if (state.ta_demo_version === 1) return
  state.ta_demo_version = 1
  if (state.users.some((user) => user.account === 'ta')) return
  state.users.push({
    id: 'u-ta-demo',
    account: 'ta',
    name: '示範助教',
    password: 'password123',
    role: 'USER',
    must_change_password: false,
    created_at: new Date().toISOString(),
  })
  if (state.courses.some((course) => course.id === 'c-phil'))
    state.enrollments.push({
      course_id: 'c-phil',
      student_id: 'u-ta-demo',
      role: 'TA',
      permissions: [...DEFAULT_TA_PERMISSIONS],
      joined_at: new Date().toISOString(),
    })
}
