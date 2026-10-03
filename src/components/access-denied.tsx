import { Link } from 'react-router-dom'
import { Button } from './ui/button.tsx'

export function AccessDenied({ home }: { home: string }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <p className="text-sm font-semibold tracking-wide text-gold-dark uppercase">STK College</p>
      <h1 className="mt-2 text-2xl font-semibold text-navy">Access denied</h1>
      <p className="mt-2 text-sm text-muted">You do not have permission to view this page.</p>
      <Button asChild className="mt-6">
        <Link to={home}>Go to your dashboard</Link>
      </Button>
    </div>
  )
}
