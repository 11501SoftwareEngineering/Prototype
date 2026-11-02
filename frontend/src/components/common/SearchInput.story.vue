<script setup lang="ts">
import { ref } from 'vue'
import SearchInput from './SearchInput.vue'

const empty = ref('')
const filled = ref('王老師')
const long = ref(
  '這是一段非常非常非常非常非常非常非常非常非常非常非常非常長的搜尋文字，用來測試會不會溢出',
)
</script>

<template>
  <Story title="SearchInput 搜尋框" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="對照 Figma（Default / Hover / Active）">
      <div class="max-w-sm space-y-4 bg-background p-6">
        <SearchInput v-model="empty" label="搜尋（預設）" />
        <p class="text-caption text-muted-foreground">
          滑鼠移上去、或點進去輸入時，外框會變深（Figma Hover / Active）。
        </p>
      </div>
    </Variant>

    <Variant title="有輸入內容（可以清除）">
      <div class="max-w-sm space-y-2 bg-background p-6">
        <SearchInput v-model="filled" label="搜尋老師" />
        <p class="text-caption text-muted-foreground">
          目前的值：「{{ filled }}」。點 ⊗ 或按 Esc 清空。
        </p>
      </div>
    </Variant>

    <Variant title="文字很長">
      <div class="max-w-sm bg-background p-6"><SearchInput v-model="long" /></div>
    </Variant>

    <Variant title="停用">
      <div class="max-w-sm bg-background p-6"><SearchInput disabled /></div>
    </Variant>

    <Variant title="頁面寬度（搭配按鈕）">
      <div class="bg-background p-6">
        <SearchInput v-model="empty" placeholder="搜尋課程" />
      </div>
    </Variant>
  </Story>
</template>
