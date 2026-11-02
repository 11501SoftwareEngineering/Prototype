<script setup lang="ts">
import { ref } from 'vue'
import ChatBubble from './ChatBubble.vue'
import ChatInput from './ChatInput.vue'

const draft = ref('')
const sent = ref<string[]>([])
const long = '問題'.repeat(80)
</script>

<template>
  <Story title="Chat 對話泡泡與輸入列" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="對照 Figma：ChatBubble（左：導魷、右：學生）">
      <div class="flex flex-col gap-6 bg-background p-6">
        <ChatBubble from="ai">{{ long }}</ChatBubble>
        <ChatBubble from="student">{{ long }}</ChatBubble>
      </div>
    </Variant>

    <Variant title="實際對話（短訊息、AI 思考中）">
      <div class="flex flex-col gap-6 bg-background p-6">
        <ChatBubble from="ai">你覺得「正義」是什麼？可以舉一個生活中的例子嗎？</ChatBubble>
        <ChatBubble from="student" name="王小明">我覺得正義就是每個人都分到一樣多。</ChatBubble>
        <ChatBubble from="ai" pending />
      </div>
    </Variant>

    <Variant title="對照 Figma：ChatInput（輸入對話）">
      <div class="space-y-4 bg-background">
        <div class="space-y-1 p-6 text-caption text-muted-foreground">
          <p>輸入文字後按 Enter 或送出鈕。已送出：</p>
          <p v-for="(s, i) in sent" :key="i" class="text-foreground">・{{ s }}</p>
        </div>
        <ChatInput
          v-model="draft"
          :remaining="3"
          :total="5"
          @send="(t) => (sent.push(t), (draft = ''))"
        />
      </div>
    </Variant>

    <Variant title="ChatInput：回覆中 / 回合用完">
      <div class="space-y-6 bg-background py-6">
        <ChatInput model-value="AI 回覆中不能送出" :remaining="2" :total="5" sending />
        <ChatInput :remaining="0" :total="5" />
      </div>
    </Variant>
  </Story>
</template>
