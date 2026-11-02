import { describe, expect, it } from 'vitest'
import { cn } from '../lib/utils'

describe('cn design tokens', () => {
  it('keeps foreground color while replacing a component font size', () => {
    expect(cn('text-sm text-foreground', 'text-header')).toBe('text-foreground text-header')
    expect(cn('text-body text-muted-foreground', 'text-h2-title')).toBe(
      'text-muted-foreground text-h2-title',
    )
  })

  it('replaces default component shadows with the requested design shadow', () => {
    expect(cn('shadow', 'shadow-elevated')).toBe('shadow-elevated')
    expect(cn('shadow-elevated', 'shadow-input')).toBe('shadow-input')
  })
})
