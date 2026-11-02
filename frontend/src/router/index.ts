import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { UserRole } from '@/api/auth'
import { homeRouteFor, useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: UserRole[]
    /** 已登入的人不需要看到的頁面（登入、註冊），會直接導回他的首頁 */
    teaching?: boolean
    guestOnly?: boolean
    /** 瀏覽器分頁標題 */
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  // 公開頁面
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/common/HomeView.vue'),
    meta: { title: '探究教室' },
  },
  {
    path: '/announcements',
    name: 'Announcements',
    component: () => import('@/views/common/AnnouncementsView.vue'),
    meta: { title: '公告' },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guestOnly: true, title: '登入' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { guestOnly: true, title: '註冊' },
  },

  // 管理員
  {
    path: '/admin',
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
    children: [
      { path: '', redirect: { name: 'AdminTeachers' } },
      {
        path: 'teachers',
        name: 'AdminTeachers',
        component: () => import('@/views/admin/TeacherManageView.vue'),
        meta: { title: '老師管理' },
      },
    ],
  },

  // 老師
  {
    path: '/teacher',
    meta: { requiresAuth: true, roles: ['TEACHER', 'STUDENT'], teaching: true },
    children: [
      { path: '', redirect: { name: 'TeacherCourses' } },
      {
        path: 'ai-settings',
        name: 'TeacherAiSettings',
        component: () => import('@/views/teacher/AiSettingsView.vue'),
        meta: { requiresAuth: true, roles: ['TEACHER'], title: 'AI 用量與金鑰' },
      },
      {
        path: 'courses',
        name: 'TeacherCourses',
        component: () => import('@/views/teacher/CourseListView.vue'),
        meta: { title: '我的課程' },
      },
      {
        path: 'courses/:courseId',
        name: 'TeacherCourse',
        component: () => import('@/views/teacher/CourseView.vue'),
        meta: { title: '問題列表' },
      },
      {
        path: 'courses/:courseId/topics/new',
        name: 'TeacherSetup',
        component: () => import('@/views/teacher/InquirySetupView.vue'),
        meta: {
          requiresAuth: true,
          roles: ['TEACHER', 'STUDENT'],
          teaching: true,
          title: '新增探究',
        },
      },
      {
        path: 'courses/:courseId/topics/:topicId/setup',
        name: 'TeacherSetupEdit',
        component: () => import('@/views/teacher/InquirySetupView.vue'),
        meta: {
          requiresAuth: true,
          roles: ['TEACHER', 'STUDENT'],
          teaching: true,
          title: '探究設定',
        },
      },
      {
        path: 'courses/:courseId/topics/:topicId',
        name: 'TeacherTopic',
        component: () => import('@/views/teacher/TopicView.vue'),
        meta: { title: '全班觀點' },
      },
    ],
  },

  // 學生
  {
    path: '/student',
    meta: { requiresAuth: true, roles: ['STUDENT'] },
    children: [
      { path: '', redirect: { name: 'StudentCourses' } },
      {
        path: 'courses',
        name: 'StudentCourses',
        component: () => import('@/views/student/CourseListView.vue'),
        meta: { title: '我的課程' },
      },
      {
        path: 'courses/:courseId',
        name: 'StudentCourse',
        component: () => import('@/views/student/CourseView.vue'),
        meta: { title: '問題列表' },
      },
      {
        path: 'courses/:courseId/topics/:topicId',
        name: 'StudentChat',
        component: () => import('@/views/student/ChatView.vue'),
        meta: { title: '對話' },
      },
      {
        path: 'courses/:courseId/sessions/:sessionId/result',
        name: 'StudentResult',
        component: () => import('@/views/student/ResultView.vue'),
        meta: { title: '對話結果' },
      },
    ],
  },

  {
    path: '/forbidden',
    name: 'Forbidden',
    component: () => import('@/views/common/ForbiddenView.vue'),
    meta: { title: '沒有權限' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/common/NotFoundView.vue'),
    meta: { title: '找不到頁面' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 1. 需要登入但還沒登入 → 登入頁，登入後跳回原本想去的頁面
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  // 2. 已登入卻打開登入、註冊頁 → 回到自己的首頁
  if (to.meta.guestOnly && authStore.isAuthenticated && authStore.userRole) {
    return { name: homeRouteFor(authStore.user!) }
  }

  if (to.meta.teaching && authStore.userRole !== 'TEACHER' && !authStore.user?.has_ta_assignments)
    return { name: 'Forbidden' }

  // 3. 身分不符（例如學生打開 /teacher）→ 沒有權限頁
  if (to.meta.roles && authStore.userRole && !to.meta.roles.includes(authStore.userRole)) {
    return { name: 'Forbidden' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title}｜問導魷` : '問導魷'
})

export default router
