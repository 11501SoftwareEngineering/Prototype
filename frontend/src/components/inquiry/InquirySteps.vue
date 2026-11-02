<script setup lang="ts">
import { Check } from '@lucide/vue'
import { useLocale } from '@/composables/useLocale'
defineProps<{ active: 1 | 2 | 3 }>()
const { t } = useLocale()
const labels = ['課程設定', '學生探究', '全班觀點']
</script>
<template>
  <ol class="inquiry-steps" :aria-label="t('教學流程')">
    <li
      v-for="(label, index) in labels"
      :key="label"
      :class="{ current: active === index + 1, done: active > index + 1 }"
      :aria-current="active === index + 1 ? 'step' : undefined"
    >
      <span class="step-number"
        ><Check v-if="active > index + 1" class="size-3.5" /><template v-else
          >0{{ index + 1 }}</template
        ></span
      ><span>{{ t(label) }}</span
      ><span v-if="index < 2" class="step-line" />
    </li>
  </ol>
</template>
