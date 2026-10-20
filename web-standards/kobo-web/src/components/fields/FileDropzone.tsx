'use client'

import * as React from 'react'
import { Upload, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { checkFile, formatFileLimit, type FileRejection } from './fileRules'

export interface FileDropzoneProps {
  /** The file types, as the file input reads them: ".pdf,.csv", "image/*". Dropped files are checked too. */
  accept?: string
  /** The largest file in bytes. */
  maxSize?: number
  onFileSelect: (file: File) => void
  /** Fires when a file is too large or of the wrong type. Without it, the zone shows the reason under itself. */
  onReject?: (file: File, reason: FileRejection) => void
  label?: string
  /** The text while a file is over the zone, so the state is never colour alone. */
  dropLabel?: string
  /** The help line under the label. The default lists the accepted types and the size limit. */
  description?: string
  /** The "or browse files" line. A string replaces it; `null` hides it. */
  browseLabel?: string | null
  /** The error when a file is too large and there is no `onReject`. */
  tooLargeMessage?: string
  /** The error when a file has the wrong type and there is no `onReject`. */
  wrongTypeMessage?: string
  icon?: LucideIcon
  /** `compact` is one line (a small icon and the label), for a zone under a list of files. */
  variant?: 'default' | 'compact'
  disabled?: boolean
  className?: string
}

/**
 * A zone to drop a file on, or to click (or press Enter or Space) to pick one. It checks the type and the size.
 *
 *     <FileDropzone accept=".pdf,image/*" maxSize={10 * 1024 * 1024} onFileSelect={attach} />
 */
export function FileDropzone({
  accept,
  maxSize,
  onFileSelect,
  onReject,
  label = 'Drop a file here',
  dropLabel = 'Drop to add the file',
  description,
  browseLabel,
  tooLargeMessage,
  wrongTypeMessage = 'That type of file is not accepted.',
  icon: Icon = Upload,
  variant = 'default',
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [dragOver, setDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const errorId = React.useId()
  const compact = variant === 'compact'

  const take = (file: File) => {
    const reason = checkFile(file, { accept, maxSize })
    if (!reason) {
      setError(null)
      onFileSelect(file)
    } else if (onReject) {
      onReject(file, reason)
    } else if (reason === 'maxSize' && maxSize) {
      setError(tooLargeMessage ?? `That file is too large. The largest size is ${formatFileLimit(maxSize)}.`)
    } else {
      setError(wrongTypeMessage)
    }
  }

  const drag = (over: boolean) => (event: React.DragEvent) => {
    event.preventDefault()
    if (!disabled) setDragOver(over)
  }

  const limits = [accept && `Accepted: ${accept}`, maxSize && `Max ${formatFileLimit(maxSize)}`].filter(Boolean).join(' · ')
  const help = description ?? limits

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={drag(true)}
        onDragEnter={drag(true)}
        onDragLeave={drag(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const file = event.dataTransfer.files[0]
          if (file && !disabled) take(file)
        }}
        data-drag-over={dragOver || undefined}
        className={cn(
          'flex items-center justify-center rounded-card border-2 border-dashed text-center',
          'transition-colors duration-(--motion-state) ease-standard',
          compact ? 'flex-row gap-2 px-4 py-2.5' : 'flex-col px-6 py-10',
          dragOver ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-brand/50',
          'disabled:cursor-not-allowed disabled:opacity-45',
          focusRing,
        )}
      >
        <Icon aria-hidden="true" className={cn('text-ink-muted', compact ? 'size-4' : 'mb-3 size-8')} />
        <span className="block text-body font-semibold text-ink">{dragOver ? dropLabel : label}</span>
        {!compact && browseLabel !== null && (
          <span className="mt-1 block text-body text-ink-muted">
            {browseLabel ?? (
              <>
                or <span className="text-brand-ink underline underline-offset-2">browse files</span>
              </>
            )}
          </span>
        )}
        {!compact && help && <span className="mt-2 block text-footnote text-ink-muted">{help}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) take(file)
          // Reset, so the same file can be picked again.
          event.target.value = ''
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="text-footnote text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
