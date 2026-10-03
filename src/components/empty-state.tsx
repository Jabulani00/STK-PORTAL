import type { ReactNode } from 'react'

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>
    </div>
  )
}
