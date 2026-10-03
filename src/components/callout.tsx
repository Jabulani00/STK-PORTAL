import type { ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

const tones = {
  info: 'border-navy/15 bg-info-soft text-navy',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-gold-dark/30 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
}

export function Callout({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <div className={cn('rounded-md border px-4 py-3 text-sm', tones[tone])}>{children}</div>
}
