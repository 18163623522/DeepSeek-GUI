/**
 * Document-level shortcuts of a paper view must not steal keys from other
 * panes (PDF reader, notes, chat) that are visible alongside it. A key
 * belongs to the view when the event target sits inside it, or — with
 * nothing focused — when the view is visible in the focused editor group.
 */
export function paperViewOwnsKeyEvent(container: HTMLElement | null, event: KeyboardEvent): boolean {
  if (!container || !container.isConnected || container.getClientRects().length === 0) return false
  const target = event.target
  const nothingFocused =
    !(target instanceof Node) || target === document.body || target === document.documentElement
  if (!nothingFocused) return container.contains(target as Node)
  const group = container.closest('.write-editor-group')
  return group ? group.getAttribute('data-focused') === 'true' : true
}
