<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RotateCw, Trash2 } from '@lucide/vue'
import { AddRingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import ListCard from './ListCard.vue'

const expanded = ref(true)
const state = reactive({
  title: '帳號：XXXXXXXX',
  description: '預設密碼：XXXXXXX',
  buttons: 1,
  highlight: false,
  clickable: false,
})
</script>

<template>
  <Story title="ListCard 列表卡片" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="遊樂場（右側調整）">
      <div class="bg-background p-6">
        <ListCard
          :title="state.title"
          :description="state.description"
          :highlight="state.highlight"
          :to="state.clickable ? '/demo' : undefined"
        >
          <template v-if="state.buttons" #actions>
            <Button v-for="i in state.buttons" :key="i" variant="destructive"
              >按鈕 <AddRingIcon
            /></Button>
          </template>
        </ListCard>
      </div>
      <template #controls>
        <HstText v-model="state.title" title="標題" />
        <HstText v-model="state.description" title="說明" />
        <HstSelect v-model="state.buttons" title="按鈕數量" :options="[0, 1, 2]" />
        <HstCheckbox v-model="state.highlight" title="Highlight" />
        <HstCheckbox v-model="state.clickable" title="可以點（to）" />
      </template>
    </Variant>

    <Variant title="對照 Figma：按鈕 0 / 1 / 2 個">
      <div class="space-y-4 bg-background p-6">
        <ListCard title="帳號：XXXXXXXX" description="預設密碼：XXXXXXX" />
        <ListCard title="帳號：XXXXXXXX" description="預設密碼：XXXXXXX">
          <template #actions
            ><Button variant="destructive">按鈕 <AddRingIcon /></Button
          ></template>
        </ListCard>
        <ListCard title="帳號：XXXXXXXX" description="預設密碼：XXXXXXX">
          <template #actions>
            <Button variant="destructive">按鈕 <AddRingIcon /></Button>
            <Button variant="destructive">按鈕 <AddRingIcon /></Button>
          </template>
        </ListCard>
      </div>
    </Variant>

    <Variant title="對照 Figma：可以點（hover 看變化）、Highlight">
      <div class="space-y-4 bg-background p-6">
        <ListCard title="哲學概論" description="課程代碼：PHIL01" to="/student/courses/c1" />
        <ListCard title="公民與社會（目前選中）" description="課程代碼：CIVI02" highlight />
        <ListCard
          title="可以點＋右邊有按鈕"
          description="按鈕仍然點得到，點其他地方會進入課程"
          to="/student/courses/c2"
        >
          <template #actions
            ><Button variant="destructive">退出課程 <Trash2 /></Button
          ></template>
        </ListCard>
      </div>
    </Variant>

    <Variant title="對照 Figma：Expand（展開學生名單）">
      <div class="space-y-4 bg-background p-6">
        <ListCard
          v-model:expanded="expanded"
          expandable
          title="哲學概論（點標題展開／收合）"
          description="學生 3 人"
        >
          <template #details>
            <p>學生帳號 s001</p>
            <p>學生帳號 s002</p>
            <p>學生帳號 s003</p>
          </template>
          <template #actions
            ><Button variant="destructive">按鈕 <AddRingIcon /></Button
          ></template>
        </ListCard>
      </div>
    </Variant>

    <Variant title="老師管理頁的用法">
      <div class="space-y-4 bg-background p-6">
        <ListCard title="帳號：wang" description="王老師">
          <template #actions>
            <Button variant="secondary">重設密碼 <RotateCw /></Button>
            <Button variant="destructive">刪除 <Trash2 /></Button>
          </template>
        </ListCard>
      </div>
    </Variant>

    <Variant title="文字很長 / 沒有說明">
      <div class="space-y-4 bg-background p-6">
        <ListCard
          title="這是一個名稱非常非常非常非常非常非常非常非常非常非常非常非常非常非常長的課程，用來測試文字溢出"
          description="說明也很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長"
        >
          <template #actions
            ><Button variant="destructive">刪除 <Trash2 /></Button
          ></template>
        </ListCard>
        <ListCard title="沒有說明文字的卡片" />
      </div>
    </Variant>
  </Story>
</template>
