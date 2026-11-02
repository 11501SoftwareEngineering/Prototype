<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, Search, ArrowUpRight, ArrowRight } from '@lucide/vue'
import { Dialog, DialogScrollContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { researchTopics, type ResearchCategory, type ResearchTopic } from '@/data/researchTopics'
import { useLocale } from '@/composables/useLocale'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [topic: ResearchTopic] }>()
const search = ref('')
const category = ref<ResearchCategory | 'all'>('all')
const { t, ageLabel } = useLocale()
const categories = {
  all: '全部',
  philosophy: '哲學',
  ethics: '倫理',
  law: '法律',
  justice: '正義',
  technology: '科技',
  economics: '經濟',
}
const results = computed(() =>
  researchTopics.filter(
    (topic) =>
      (category.value === 'all' || topic.category === category.value) &&
      `${topic.title} ${topic.question}`.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
)
function select(topic: ResearchTopic) {
  emit('select', topic)
  open.value = false
}
</script>
<template>
  <Dialog v-model:open="open"
    ><DialogScrollContent class="max-w-5xl rounded-2xl border-border bg-background p-0 sm:p-0">
      <div class="sticky top-0 z-10 border-b border-border bg-background p-6 sm:px-8">
        <p class="eyebrow mb-2">THE INQUIRY LIBRARY</p>
        <DialogTitle class="text-2xl font-bold"
          >{{ t('研究主題庫')
          }}<span class="ml-3 text-sm font-normal text-muted-foreground">18</span></DialogTitle
        ><DialogDescription class="mt-2 text-sm leading-6">{{
          t('建議設定可調整；套用時保留你選擇的年齡層與回合。')
        }}</DialogDescription
        ><label class="search-field mt-5"
          ><Search class="size-4" /><input
            v-model="search"
            type="search"
            :placeholder="t('搜尋主題或核心問題')"
            :aria-label="t('搜尋主題或核心問題')"
        /></label>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="(label, key) in categories"
            :key="key"
            class="filter-chip"
            :class="{ selected: category === key }"
            :aria-pressed="category === key"
            @click="category = key"
          >
            {{ t(label) }}
          </button>
        </div>
      </div>
      <div class="max-h-[60vh] overflow-y-auto px-6 pb-7 sm:px-8">
        <p class="my-4 text-xs text-muted-foreground">
          {{ results.length }} / 18 · {{ t('來源語言為繁體中文；其他語言須另行審閱。') }}
        </p>
        <div v-if="results.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article v-for="topic in results" :key="topic.id" class="library-card">
            <div class="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
              <span class="rounded-md bg-primary/15 px-2 py-1 text-foreground">{{
                t(categories[topic.category])
              }}</span
              ><span class="text-muted-foreground"
                >{{ ageLabel(topic.age) }} · 10 {{ t('回合') }}</span
              >
            </div>
            <BookOpen class="mb-3 size-5 text-muted-foreground/60" />
            <h3 class="text-base font-bold leading-7">{{ topic.title }}</h3>
            <p class="mb-5 mt-2 flex-1 text-sm leading-7 text-muted-foreground">
              {{ topic.question }}
            </p>
            <details class="mb-4 text-xs text-muted-foreground">
              <summary class="cursor-pointer py-1">{{ t('研究來源') }}</summary>
              <a
                v-for="source in topic.sources"
                :key="source.url"
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 flex items-start gap-1 leading-6 underline decoration-border underline-offset-4"
                >{{ source.title }}<ArrowUpRight class="mt-1 size-3 shrink-0"
              /></a>
            </details>
            <Button variant="outline" class="w-full justify-between" @click="select(topic)"
              >{{ t('使用此主題') }}<ArrowRight class="size-4"
            /></Button>
          </article>
        </div>
        <div v-else class="empty-state">{{ t('找不到符合的主題') }}</div>
      </div>
    </DialogScrollContent></Dialog
  >
</template>
