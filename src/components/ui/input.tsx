import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-navy',
        className,
      )}
      {...props}
    />
  )
}
