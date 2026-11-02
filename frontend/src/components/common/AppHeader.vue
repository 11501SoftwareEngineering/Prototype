<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { ROLE_LABELS } from '@/api/auth'
import AccountBadge from '@/components/common/AccountBadge.vue'
import AppLogo from '@/components/common/AppLogo.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocale, type Locale } from '@/composables/useLocale'
import { homeRouteFor, useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore(),
  { locale, t, setLocale } = useLocale()
const isMock = import.meta.env.VITE_USE_MOCK === 'true'
const role = computed(() => (authStore.isAuthenticated ? authStore.userRole : null))
interface NavItem {
  label: string
  to: RouteLocationRaw
}
const navItems = computed<NavItem[]>(() => {
  if (role.value === 'SUPER_ADMIN') return [{ label: '管理帳號', to: { name: 'AdminTeachers' } }]
  if (role.value !== 'STUDENT' && role.value !== 'TEACHER') return []
  const items: NavItem[] = [{ label: '我的課程', to: { name: homeRouteFor(authStore.user!) } }]
  if (role.value === 'STUDENT' && authStore.user?.has_ta_assignments)
    items.push({ label: '學生課程', to: { name: 'StudentCourses' } })
  return items
})
const homeLink = computed<RouteLocationRaw>(() =>
  role.value ? { name: homeRouteFor(authStore.user!) } : { name: 'Home' },
)
</script>
<template>
  <header class="relative z-40 shrink-0 border-b border-border bg-card">
    <div
      class="grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:gap-6 sm:px-7"
    >
      <RouterLink :to="homeLink" class="flex w-fit items-center gap-2.5 rounded-lg"
        ><AppLogo :size="34" class="rounded-md" /><span
          class="hidden whitespace-nowrap text-lg font-bold tracking-wide sm:inline"
          >問導魷<span
            class="ml-3 hidden border-l border-border pl-3 text-[10px] font-normal tracking-[.12em] text-muted-foreground xl:inline"
            >SOCRATIC CLASSROOM</span
          ></span
        ></RouterLink
      >
      <nav
        v-if="navItems.length"
        aria-label="主要導覽"
        class="min-w-0 justify-self-start sm:justify-self-center"
      >
        <ul class="flex items-center gap-5">
          <li
            v-for="(item, index) in navItems"
            :key="item.label"
            class="min-w-0"
            :class="index > 0 ? 'hidden md:block' : ''"
          >
            <RouterLink
              :to="item.to"
              :title="item.label"
              class="block max-w-40 truncate rounded text-xs text-muted-foreground hover:text-foreground"
              >{{ t(item.label) }}</RouterLink
            >
          </li>
        </ul>
      </nav>
      <span v-else />
      <div class="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
        <span
          v-if="isMock"
          class="hidden rounded-full bg-primary/10 px-2 py-1 text-[9px] text-muted-foreground xl:inline"
          >DEMO</span
        ><label class="sr-only" for="interface-language">介面語言</label
        ><select
          id="interface-language"
          :value="locale"
          class="max-w-24 rounded-md border-0 bg-transparent py-2 text-[11px] text-muted-foreground"
          @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <DropdownMenu v-if="authStore.user"
          ><DropdownMenuTrigger class="min-w-0 rounded-full" aria-label="開啟帳號選單"
            ><AccountBadge
              :name="authStore.user.name"
              :role-label="
                authStore.user.role === 'STUDENT' && route.meta.teaching
                  ? '助教'
                  : ROLE_LABELS[authStore.user.role]
              " /></DropdownMenuTrigger
          ><DropdownMenuContent align="end" class="w-36 rounded-lg border border-border bg-card p-1"
            ><DropdownMenuItem
              v-if="role === 'STUDENT' && authStore.user?.has_ta_assignments"
              as-child
              class="cursor-pointer px-3 py-2 text-sm focus:bg-muted"
              ><RouterLink :to="{ name: 'StudentCourses' }">學生課程</RouterLink></DropdownMenuItem
            ><DropdownMenuItem
              v-if="role === 'TEACHER'"
              as-child
              class="cursor-pointer px-3 py-2 text-sm focus:bg-muted"
              ><RouterLink :to="{ name: 'TeacherAiSettings' }"
                >AI 用量與金鑰</RouterLink
              ></DropdownMenuItem
            ><DropdownMenuItem
              class="cursor-pointer px-3 py-2 text-sm focus:bg-muted"
              @select="authStore.logout()"
              >{{ t('登出') }}</DropdownMenuItem
            ></DropdownMenuContent
          ></DropdownMenu
        >
        <div v-else class="flex items-center gap-1">
          <Button as-child variant="ghost"
            ><RouterLink :to="{ name: 'Register' }">{{ t('註冊') }}</RouterLink></Button
          ><Button as-child variant="secondary"
            ><RouterLink :to="{ name: 'Login' }">{{ t('登入') }}</RouterLink></Button
          >
        </div>
      </div>
    </div>
  </header>
</template>
