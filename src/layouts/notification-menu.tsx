import { Bell } from 'lucide-react'
import { markNotificationsRead } from '../services/api.ts'
import { useCurrentUser, useDatabase, useSyncPortal } from '../hooks/use-portal.ts'
import { formatDateTime } from '../lib/format.ts'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../components/ui/dropdown-menu.tsx'

export function NotificationMenu() {
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  if (!user) return null
  const notes = database.notifications.filter((item) => item.userId === user.id)
  const unread = notes.filter((item) => !item.read).length

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unread > 0) {
          markNotificationsRead(user.id)
          sync()
        }
      }}
    >
      <DropdownMenuTrigger className="relative rounded-md p-2 text-navy hover:bg-canvas" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
            {unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {notes.length === 0 ? <DropdownMenuItem>No notifications yet.</DropdownMenuItem> : null}
        {notes.slice(0, 6).map((note) => (
          <DropdownMenuItem key={note.id} className="grid gap-0.5">
            <span className="font-semibold">{note.title}</span>
            <span className="text-xs text-muted">{note.body}</span>
            <span className="text-xs text-muted">{formatDateTime(note.createdAt)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
