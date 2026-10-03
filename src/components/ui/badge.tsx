import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

const tones = {
  neutral: 'bg-canvas text-ink',
  navy: 'bg-info-soft text-navy',
  gold: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}
      {...props}
    />
  )
}
