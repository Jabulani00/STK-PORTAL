import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AccessDenied } from '../components/access-denied.tsx'
import { useCurrentUser } from '../hooks/use-portal.ts'
import { isStaffRole } from '../services/access.ts'
import type { Role } from '../types/index.ts'

export function RequireAuth({ area }: { area: 'student' | 'staff' }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  const allowed = area === 'student' ? user.role === 'student' : isStaffRole(user.role)
  if (!allowed) return <AccessDenied home={user.role === 'student' ? '/app' : '/staff'} />
  return <Outlet />
}

export function RequireRoles({ roles }: { roles: Role[] }) {
  const user = useCurrentUser()
  if (!user) return null
  if (!roles.includes(user.role)) return <AccessDenied home="/staff" />
  return <Outlet />
}
