<script setup lang="ts">
import { ref } from 'vue'
import { AddRingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import AccountBadge from './AccountBadge.vue'
import AppCheckbox from './AppCheckbox.vue'
import AppLogo from './AppLogo.vue'
import PageHeader from './PageHeader.vue'

const anonymous = ref(false)
const agreed = ref(true)
</script>

<template>
  <Story title="其他小元件" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="AppCheckbox 核取方塊">
      <div class="flex flex-col items-start gap-4 bg-background p-6">
        <AppCheckbox v-model="anonymous">匿名分享我的結論</AppCheckbox>
        <AppCheckbox v-model="agreed">已勾選</AppCheckbox>
        <AppCheckbox disabled>停用</AppCheckbox>
        <p class="text-caption text-muted-foreground">
          匿名：{{ anonymous }}。點文字也能切換，Tab 移到上面後按空白鍵也可以。
        </p>
      </div>
    </Variant>

    <Variant title="AccountBadge 帳戶資訊">
      <div class="flex flex-col items-end gap-6 bg-primary p-6">
        <AccountBadge name="帳戶名稱" role-label="身分" />
        <AccountBadge name="王小明" role-label="學生" />
        <AccountBadge name="名字非常非常非常長的使用者" role-label="管理員" />
      </div>
    </Variant>

    <Variant title="AppLogo">
      <div class="flex flex-wrap items-end gap-6 bg-card p-6">
        <AppLogo />
        <AppLogo :size="64" />
        <AppLogo :size="48" />
        <AppLogo :size="40" icon-only />
      </div>
    </Variant>

    <Variant title="PageHeader 頁面標題（Figma 沒有獨立元件，依各頁標題整理）">
      <div class="space-y-8 bg-background p-6">
        <PageHeader title="老師管理" />
        <PageHeader title="我的課程" description="輸入老師提供的邀請碼加入新課程">
          <template #actions
            ><Button>加入課程 <AddRingIcon /></Button
          ></template>
        </PageHeader>
      </div>
    </Variant>
  </Story>
</template>
