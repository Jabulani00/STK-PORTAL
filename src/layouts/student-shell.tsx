import { Award, BookOpen, CalendarCheck, ClipboardList, House, Inbox, LifeBuoy, Megaphone, Menu, MessageSquare, UserRound } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from '../components/logo.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx'
import { cn } from '../lib/cn.ts'
import { AnimatedOutlet } from './animated-outlet.tsx'
import { NotificationMenu } from './notification-menu.tsx'
import { UserMenu } from './user-menu.tsx'

const links = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/courses', label: 'Courses', icon: BookOpen, end: false },
  { to: '/app/results', label: 'Results', icon: ClipboardList, end: false },
  { to: '/app/certificates', label: 'Certificates', icon: Award, end: false },
  { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck, end: false },
  { to: '/app/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/app/messages', label: 'Messages', icon: MessageSquare, end: false },
  { to: '/app/support', label: 'Support', icon: LifeBuoy, end: false },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox, end: false },
  { to: '/app/profile', label: 'Profile', icon: UserRound, end: false },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1" aria-label="Student">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold',
              isActive ? 'bg-info-soft text-navy' : 'text-muted hover:bg-canvas',
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

export function StudentShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const bottom = links.slice(0, 3)

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <NotificationMenu />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="no-print hidden px-3 py-6 md:block">
          <NavItems />
        </aside>
        <main id="main" className="px-4 py-6 pb-24 md:pb-10">
          <AnimatedOutlet />
        </main>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white md:hidden" aria-label="Student mobile">
        {bottom.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn('grid place-items-center gap-1 py-2 text-xs font-semibold', isActive ? 'text-navy' : 'text-muted')
            }
          >
            <link.icon className="h-5 w-5" aria-hidden="true" />
            {link.label}
          </NavLink>
        ))}
        <button type="button" className="grid place-items-center gap-1 py-2 text-xs font-semibold text-muted" onClick={() => setMoreOpen(true)}>
          <Menu className="h-5 w-5" aria-hidden="true" />
          More
        </button>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <NavItems onNavigate={() => setMoreOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
