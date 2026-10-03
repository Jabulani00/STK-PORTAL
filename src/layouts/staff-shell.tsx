import {
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MessageSquare,
  PieChart,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from '../components/logo.tsx'
import { ScrollArea } from '../components/ui/scroll-area.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx'
import { cn } from '../lib/cn.ts'
import { useCurrentUser } from '../hooks/use-portal.ts'
import type { Role } from '../types/index.ts'
import { AnimatedOutlet } from './animated-outlet.tsx'
import { NotificationMenu } from './notification-menu.tsx'
import { UserMenu } from './user-menu.tsx'

const links: { to: string; label: string; icon: LucideIcon; end?: boolean; roles?: Role[] }[] = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/students', label: 'Students', icon: Users },
  { to: '/staff/enrolments', label: 'Enrolments', icon: GraduationCap },
  { to: '/staff/courses', label: 'Courses', icon: BookOpen },
  { to: '/staff/materials', label: 'Materials', icon: FileText },
  { to: '/staff/assessments', label: 'Assessments', icon: ClipboardList },
  { to: '/staff/results', label: 'Results', icon: BarChart3 },
  { to: '/staff/certificates', label: 'Certificates', icon: Award },
  { to: '/staff/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/staff/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/staff/analytics', label: 'Analytics', icon: PieChart },
  { to: '/staff/messages', label: 'Messages', icon: MessageSquare },
  { to: '/staff/email', label: 'Email', icon: Mail },
  { to: '/staff/tickets', label: 'Tickets', icon: LifeBuoy },
  { to: '/staff/reports', label: 'Reports', icon: FileText },
  { to: '/staff/users', label: 'Users and roles', icon: Shield, roles: ['super_admin'] },
  { to: '/staff/audit', label: 'Audit log', icon: ScrollText, roles: ['super_admin'] },
  { to: '/staff/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'administrator'] },
]

function StaffNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const visible = links.filter((link) => !link.roles || (user && link.roles.includes(user.role)))
  return (
    <nav className="grid gap-1 p-3" aria-label="Staff">
      {visible.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm font-semibold',
              isActive ? 'border-gold bg-white/10 text-white' : 'border-transparent text-white/75 hover:bg-white/5',
            )
          }
        >
          <link.icon className="h-4 w-4" aria-hidden="true" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function StaffShell() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="no-print hidden bg-navy md:flex md:min-h-screen md:flex-col">
        <div className="px-4 py-5">
          <Logo tone="light" />
        </div>
        <ScrollArea className="h-[calc(100vh-5.5rem)]">
          <StaffNav />
        </ScrollArea>
      </aside>
      <div>
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white px-4 md:px-8">
          <button type="button" className="rounded-md p-2 text-navy md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden text-sm text-muted md:block">Staff workspace</p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationMenu />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="px-4 py-6 md:px-8">
          <AnimatedOutlet />
        </main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Menu</DialogTitle>
          </DialogHeader>
          <StaffNav onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
