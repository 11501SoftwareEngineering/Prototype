<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '.'

const account = ref('')
const filled = ref('teacher01')
</script>

<template>
  <Story title="Input 輸入框" group="ui" :layout="{ type: 'single', iframe: true }">
    <Variant title="搭配 label（建議寫法）">
      <div class="flex max-w-xl items-center gap-4 p-6">
        <label for="story-account" class="w-20 shrink-0 text-header text-foreground">帳號：</label>
        <Input
          id="story-account"
          v-model="account"
          placeholder="請輸入帳號"
          autocomplete="username"
        />
      </div>
      <p class="px-6 text-caption text-muted-foreground">
        label 的 for 要對上 Input 的 id，點文字才會跳到輸入框，螢幕報讀器也才知道這格要填什麼。
      </p>
    </Variant>

    <Variant title="各種狀態">
      <div class="max-w-md space-y-4 p-6">
        <Input aria-label="空白" placeholder="空白（placeholder）" />
        <Input v-model="filled" aria-label="有內容" />
        <Input aria-label="密碼" type="password" model-value="password1" />
        <Input aria-label="停用" placeholder="disabled" disabled />
      </div>
    </Variant>
  </Story>
</template>
