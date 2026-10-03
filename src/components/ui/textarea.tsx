import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-navy',
        className,
      )}
      {...props}
    />
  )
}
