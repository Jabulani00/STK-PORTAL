import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { initials } from '../lib/format.ts'
import { fullName } from '../lib/format.ts'
import { roleLabels } from '../lib/labels.ts'
import { clearSession } from '../services/session.ts'
import { useCurrentUser } from '../hooks/use-portal.ts'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../components/ui/dropdown-menu.tsx'

export function UserMenu({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={tone === 'light' ? 'flex items-center gap-2 rounded-md px-2 py-1 text-white' : 'flex items-center gap-2 rounded-md px-2 py-1 text-navy'}
        aria-label="Account menu"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-xs font-bold text-navy">{initials(user)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight">{fullName(user)}</span>
          <span className={tone === 'light' ? 'block text-xs text-white/70' : 'block text-xs text-muted'}>{roleLabels[user.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            clearSession()
            queryClient.setQueryData(['session'], null)
            navigate('/login')
          }}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
