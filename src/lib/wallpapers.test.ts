import { describe, expect, it } from 'vitest'
import { WALLPAPERS } from './theme'

describe('wallpapers', () => {
  it('keeps existing ids and adds new unique ones', () => {
    const ids = WALLPAPERS.map((w) => w.id)
    for (const id of ['none', 'dots', 'glow', 'aurora', 'mesh', 'paws', 'leaves']) expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
