import { describe, expect, it } from 'vitest'
import { countGroups, textLength, validateSetup } from '../inquiry'
import { researchTopics, setupFromResearch } from '@/data/researchTopics'

describe('inquiry invariants', () => {
  it('counts Unicode code points consistently and trims the description', () => {
    expect(textLength('  一😀二  ')).toBe(3)
  })
  it('keeps all 18 templates editable without replacing teacher choices', () => {
    expect(researchTopics).toHaveLength(18)
    for (const topic of researchTopics) {
      const setup = setupFromResearch(topic, 'university_plus', 15)
      expect(setup.age_band).toBe('university_plus')
      expect(setup.max_turns).toBe(15)
      expect(validateSetup(setup)).toBe(true)
    }
  })
  it('rejects missing, duplicated and foreign report IDs instead of fabricating counts', () => {
    const group = {
      group_id: 'g',
      title: 'Conditional stance',
      description: 'Based on actual evidence',
      report_ids: ['r1'],
    }
    expect(countGroups([group], ['r1', 'r2'], ['r2'])[0]).toMatchObject({
      count: 1,
      percentage: 50,
    })
    expect(() => countGroups([group, group], ['r1'], [])).toThrow(
      'Invalid or duplicate report membership',
    )
    expect(() => countGroups([group], ['r1', 'r2'], [])).toThrow('Incomplete report membership')
    expect(() => countGroups([group], ['r2'], [])).toThrow('Invalid or duplicate report membership')
  })
})
