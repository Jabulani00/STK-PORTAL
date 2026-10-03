import mark from '../assets/STKLogo2.png'
import { cn } from '../lib/cn.ts'

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const light = tone === 'light'
  return (
    <span className="flex items-center gap-3">
      <img
        src={mark}
        alt=""
        className="h-11 w-11 shrink-0 rounded-md bg-navy object-contain"
      />
      <span>
        <span className={cn('block text-sm font-semibold leading-tight', light ? 'text-white' : 'text-navy')}>
          STK College
        </span>
        <span className={cn('block text-xs', light ? 'text-white/70' : 'text-muted')}>Student & Staff Portal</span>
      </span>
    </span>
  )
}
