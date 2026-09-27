import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Folder, FolderInput, FolderPlus, Inbox, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePaperModeStore } from '../../../paper/paper-mode-store'
import {
  createPaperFolder,
  importFolderLabel,
  normalizePaperFolderInput,
  setImportFolder,
  useImportFolder
} from '../../../paper/paper-import-target'

const MENU_WIDTH = 272
const MENU_MAX_HEIGHT = 340

type MenuPosition = { left: number; top?: number; bottom?: number; maxHeight: number }

function menuPosition(anchor: HTMLElement): MenuPosition {
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8)
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  return below >= MENU_MAX_HEIGHT || below >= above
    ? { left, top: rect.bottom + 4, maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(0, below)) }
    : { left, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(0, above)) }
}

/** Display rows: nested folders indent under a listed parent. */
function folderRows(groups: readonly string[]): { folder: string; label: string; depth: number }[] {
  const known = new Set(groups)
  return groups.map((folder) => {
    const segments = folder.split('/')
    const parent = segments.slice(0, -1).join('/')
    const nested = parent !== '' && known.has(parent)
    return {
      folder,
      label: nested ? segments[segments.length - 1] : folder,
      depth: nested ? segments.length - 1 : 0
    }
  })
}

/**
 * "Import to <folder>" chip shared by every paper import entry point. The
 * menu lists Unfiled plus the library's folders (with paper counts) and can
 * create a new folder inline; the choice is remembered per library.
 */
export function PaperImportFolderPicker({
  showPrefix = true,
  className = ''
}: {
  showPrefix?: boolean
  className?: string
}): ReactElement {
  const { t } = useTranslation('common')
  const folder = useImportFolder()
  const groups = usePaperModeStore((s) => s.groups)
  const entries = usePaperModeStore((s) => s.entries)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const open = position !== null

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) map.set(entry.group, (map.get(entry.group) ?? 0) + 1)
    return map
  }, [entries])
  const rows = useMemo(() => folderRows(groups.includes(folder) || !folder ? groups : [...groups, folder].sort()), [groups, folder])

  const close = (): void => {
    setPosition(null)
    setCreating(false)
    setDraft('')
    setError(null)
  }

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    setPosition(menuPosition(anchorRef.current))
  }, [open, creating])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const choose = (next: string): void => {
    setImportFolder(next)
    close()
  }

  const create = async (): Promise<void> => {
    if (busy) return
    const normalized = normalizePaperFolderInput(draft)
    if (!normalized) {
      setError(t('paperImportFolderInvalid'))
      return
    }
    if (groups.includes(normalized)) {
      choose(normalized)
      return
    }
    setBusy(true)
    const result = await createPaperFolder(normalized)
    setBusy(false)
    if (result.ok) choose(result.folder)
    else setError(result.message === 'invalid' ? t('paperImportFolderInvalid') : result.message)
  }

  const label = importFolderLabel(folder, t('paperImportFolderRoot'))
  const rowClass = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition hover:bg-ds-hover'

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('paperImportFolderTooltip', { folder: folder || t('paperImportFolderRoot') })}
        onClick={() => (open ? close() : setPosition(menuPosition(anchorRef.current!)))}
        className={`inline-flex h-7 min-w-0 max-w-[220px] shrink items-center gap-1.5 rounded-md px-2 text-[12px] transition ${
          open ? 'bg-ds-hover text-ds-ink' : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
        } ${className}`}
      >
        <FolderInput className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
        {showPrefix ? <span className="shrink-0 text-ds-faint">{t('paperImportFolderTo')}</span> : null}
        <span className="min-w-0 truncate font-medium text-ds-ink">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-ds-faint" strokeWidth={2} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ left: position.left, top: position.top, bottom: position.bottom, width: MENU_WIDTH, maxHeight: position.maxHeight }}
              className="ds-no-drag fixed z-[90] flex flex-col rounded-xl border border-ds-border bg-ds-elevated p-1.5 shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
            >
              <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium text-ds-faint">{t('paperImportFolderTitle')}</div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <button type="button" role="menuitemradio" aria-checked={!folder} onClick={() => choose('')} className={rowClass}>
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate text-ds-ink">
                    {t('paperImportFolderRoot')}
                    <span className="ml-1.5 text-[11px] text-ds-faint">{t('paperImportFolderRootHint')}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ds-faint">{counts.get('') ?? 0}</span>
                  <Check className={`h-3.5 w-3.5 shrink-0 text-[var(--ds-accent)] ${folder ? 'invisible' : ''}`} strokeWidth={2} />
                </button>
                {rows.map((row) => (
                  <button
                    key={row.folder}
                    type="button"
                    role="menuitemradio"
                    aria-checked={folder === row.folder}
                    title={row.folder}
                    onClick={() => choose(row.folder)}
                    className={rowClass}
                    style={{ paddingLeft: 8 + row.depth * 14 }}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate text-ds-ink">{row.label}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ds-faint">{counts.get(row.folder) ?? 0}</span>
                    <Check className={`h-3.5 w-3.5 shrink-0 text-[var(--ds-accent)] ${folder === row.folder ? '' : 'invisible'}`} strokeWidth={2} />
                  </button>
                ))}
              </div>
              <div className="mt-1 border-t border-ds-border-muted pt-1">
                {creating ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void create()
                    }}
                    className="px-1 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value)
                          setError(null)
                        }}
                        placeholder={t('paperImportFolderNewPlaceholder')}
                        className="h-8 min-w-0 flex-1 rounded-md border border-ds-border-muted bg-ds-main px-2 text-[12.5px] text-ds-ink outline-none focus:border-[var(--ds-accent)]"
                      />
                      <button
                        type="submit"
                        disabled={busy || !draft.trim()}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {t('paperImportFolderCreate')}
                      </button>
                    </div>
                    {error ? <p className="mt-1 px-0.5 text-[11px] leading-4 text-red-600 dark:text-red-300">{error}</p> : null}
                  </form>
                ) : (
                  <button type="button" onClick={() => setCreating(true)} className={`${rowClass} text-ds-muted hover:text-ds-ink`}>
                    <FolderPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                    {t('paperImportFolderNew')}
                  </button>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
