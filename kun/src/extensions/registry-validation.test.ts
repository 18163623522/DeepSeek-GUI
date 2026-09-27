import { describe, expect, it } from 'vitest'
import { canonicalizeInstalledPackagePath } from './registry-validation.js'

const legacy = 'C:\\Users\\Administrator\\.kun\\data\\extensions\\acme.demo\\1.0.0'
const current = 'c:\\users\\administrator\\.kun\\data\\extensions\\acme.demo\\1.0.0'

describe('canonicalizeInstalledPackagePath', () => {
  it('rewrites a Windows package path that differs only by case or separators', () => {
    expect(canonicalizeInstalledPackagePath(legacy, current, 'win32')).toBe(current)
    expect(canonicalizeInstalledPackagePath(
      'C:/Users/Administrator/.kun/data/extensions/acme.demo/1.0.0',
      current,
      'win32'
    )).toBe(current)
    expect(canonicalizeInstalledPackagePath(`\\\\?\\${legacy}`, current, 'win32')).toBe(current)
  })

  it('leaves a different Windows directory unchanged', () => {
    const other = 'C:\\Users\\Administrator\\.kun\\data\\extensions\\acme.other\\1.0.0'
    expect(canonicalizeInstalledPackagePath(other, current, 'win32')).toBe(other)
    expect(canonicalizeInstalledPackagePath(
      'C:\\Users\\Administrator\\.kun\\data\\extensions\\acme.demo\\1.0.0\\..\\..\\other\\1.0.0',
      current,
      'win32'
    )).toBe('C:\\Users\\Administrator\\.kun\\data\\extensions\\acme.demo\\1.0.0\\..\\..\\other\\1.0.0')
  })

  it('preserves case on a case-sensitive platform', () => {
    expect(canonicalizeInstalledPackagePath(
      '/tmp/Extensions/acme.demo/1.0.0',
      '/tmp/extensions/acme.demo/1.0.0',
      'linux'
    )).toBe('/tmp/Extensions/acme.demo/1.0.0')
  })
})
