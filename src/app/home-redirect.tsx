import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/use-portal.ts'

export function HomeRedirect() {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'student' ? '/app' : '/staff'} replace />
}
