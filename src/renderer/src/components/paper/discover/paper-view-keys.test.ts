// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { paperViewOwnsKeyEvent } from './paper-view-keys'

function mount(focused: boolean): { view: HTMLElement; sibling: HTMLElement } {
  document.body.innerHTML = `
    <section class="write-editor-group" data-focused="${focused}"><div id="view"><button id="inside"></button></div></section>
    <section class="write-editor-group" data-focused="${!focused}"><div id="pdf" tabindex="0"></div></section>`
  const view = document.getElementById('view')!
  // jsdom has no layout; treat mounted nodes as visible.
  view.getClientRects = () => [{}] as unknown as DOMRectList
  return { view, sibling: document.getElementById('pdf')! }
}

function keyFrom(target: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('paperViewOwnsKeyEvent', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('owns keys aimed inside the view', () => {
    const { view } = mount(false)
    expect(paperViewOwnsKeyEvent(view, keyFrom(document.getElementById('inside')!))).toBe(true)
  })

  it('ignores keys aimed at a neighbouring pane', () => {
    const { view, sibling } = mount(true)
    expect(paperViewOwnsKeyEvent(view, keyFrom(sibling))).toBe(false)
  })

  it('with nothing focused, follows the focused editor group', () => {
    expect(paperViewOwnsKeyEvent(mount(true).view, keyFrom(document.body))).toBe(true)
    expect(paperViewOwnsKeyEvent(mount(false).view, keyFrom(document.body))).toBe(false)
  })

  it('ignores hidden or detached views', () => {
    const { view } = mount(true)
    view.getClientRects = () => [] as unknown as DOMRectList
    expect(paperViewOwnsKeyEvent(view, keyFrom(document.body))).toBe(false)
    expect(paperViewOwnsKeyEvent(null, keyFrom(document.body))).toBe(false)
  })
})
