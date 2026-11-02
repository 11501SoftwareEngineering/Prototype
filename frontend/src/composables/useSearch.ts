import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

/**
 * 列表頁的搜尋：在已經拿到的資料裡用關鍵字篩選（不打 API）。
 *
 *   const { keyword, results } = useSearch(() => data.value ?? [], (t) => [t.account, t.name])
 */
export function useSearch<T>(
  items: MaybeRefOrGetter<T[]>,
  fields: (item: T) => (string | null | undefined)[],
) {
  const keyword = ref('')
  const results = computed(() => {
    const list = toValue(items)
    const term = keyword.value.trim().toLocaleLowerCase()
    if (!term) return list
    return list.filter((item) =>
      fields(item).some((text) => (text ?? '').toLocaleLowerCase().includes(term)),
    )
  })
  return { keyword, results }
}
