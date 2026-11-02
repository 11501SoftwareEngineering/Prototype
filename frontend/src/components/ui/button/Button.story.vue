<script setup lang="ts">
import { reactive } from 'vue'
import { RotateCw, Trash2 } from '@lucide/vue'
import { AddRingIcon } from '@/components/icons'
import { Button } from '.'

const variants = ['default', 'secondary', 'destructive', 'ghost', 'ghost-muted'] as const
const variantLabels: Record<(typeof variants)[number], string> = {
  default: 'Primary 主色',
  secondary: 'Secondary 輔色',
  destructive: 'Red 點綴色',
  ghost: 'Text / Primary',
  'ghost-muted': 'Text / Secondary',
}

const state = reactive({
  variant: 'default' as (typeof variants)[number],
  size: 'sm' as 'sm' | 'lg',
  text: '新增老師',
  icon: true,
  disabled: false,
})
</script>

<template>
  <Story title="Button 按鈕" group="ui" :layout="{ type: 'single', iframe: true }">
    <Variant title="遊樂場（右側調整）">
      <div class="p-6">
        <Button :variant="state.variant" :size="state.size" :disabled="state.disabled">
          {{ state.text }}
          <AddRingIcon v-if="state.icon" />
        </Button>
      </div>
      <template #controls>
        <HstSelect v-model="state.variant" title="variant" :options="[...variants]" />
        <HstSelect v-model="state.size" title="size" :options="['sm', 'lg']" />
        <HstText v-model="state.text" title="文字" />
        <HstCheckbox v-model="state.icon" title="圖示" />
        <HstCheckbox v-model="state.disabled" title="disabled" />
      </template>
    </Variant>

    <Variant title="對照 Figma：Large">
      <div class="flex flex-wrap items-center gap-4 p-6">
        <Button size="lg">按鈕</Button>
        <Button variant="secondary" size="lg">按鈕</Button>
        <Button variant="destructive" size="lg">按鈕</Button>
      </div>
      <p class="px-6 text-caption text-muted-foreground">
        滑鼠移上去會疊 20% 黑色（Figma State=Hover）。
      </p>
    </Variant>

    <Variant title="對照 Figma：Small">
      <div class="space-y-4 p-6">
        <div class="flex flex-wrap items-center gap-4">
          <Button>按鈕</Button>
          <Button variant="secondary">按鈕</Button>
          <Button variant="destructive">按鈕</Button>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <Button>按鈕 <AddRingIcon /></Button>
          <Button variant="secondary">按鈕 <AddRingIcon /></Button>
          <Button variant="destructive">按鈕 <AddRingIcon /></Button>
        </div>
      </div>
    </Variant>

    <Variant title="對照 Figma：Text">
      <div class="flex flex-wrap items-center gap-6 p-6">
        <Button variant="ghost">按鈕</Button>
        <Button variant="ghost-muted">按鈕</Button>
      </div>
      <p class="px-6 text-caption text-muted-foreground">
        ghost：深色字、hover 變淺。ghost-muted：淺色字、hover 變深。按住時字會變粗（Figma
        State=Pressed）。
      </p>
    </Variant>

    <Variant title="所有樣式一覽（含 disabled）">
      <div class="space-y-5 p-6">
        <div v-for="v in variants" :key="v" class="flex flex-wrap items-center gap-4">
          <code class="w-36 text-caption text-muted-foreground">{{ variantLabels[v] }}</code>
          <Button :variant="v">Small</Button>
          <Button :variant="v">有圖示 <AddRingIcon /></Button>
          <Button :variant="v" size="lg">Large</Button>
          <Button :variant="v" disabled>disabled</Button>
        </div>
      </div>
    </Variant>

    <Variant title="實際用法">
      <div class="space-y-4 p-6">
        <div class="flex flex-wrap items-center gap-4">
          <Button>新增老師 <AddRingIcon /></Button>
          <Button variant="secondary">重設密碼 <RotateCw /></Button>
          <Button variant="destructive">刪除 <Trash2 /></Button>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="lg">註冊</Button>
          <Button size="lg">登入</Button>
        </div>
        <p class="text-caption text-muted-foreground">
          Figma 沒有提供的圖示（重設、刪除）用 @lucide/vue。
        </p>
      </div>
    </Variant>

    <Variant title="鍵盤焦點（按 Tab 看外框）">
      <div class="flex flex-wrap items-center gap-4 p-6">
        <Button>第一個</Button>
        <Button variant="secondary">第二個</Button>
        <Button variant="destructive">第三個</Button>
      </div>
    </Variant>
  </Story>
</template>
