import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button.tsx'
import { usePageTitle } from '../hooks/use-portal.ts'

export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold text-navy">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That address is not part of the portal.</p>
      <Button asChild className="mt-6 w-fit"><Link to="/">Back to the portal</Link></Button>
    </div>
  )
}
