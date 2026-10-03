import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { canPostSystemAnnouncement, userById, visibleAnnouncements, visibleCourses } from '../../services/access.ts'
import { createAnnouncement } from '../../services/api.ts'

export function StudentAnnouncements() {
  usePageTitle('Announcements')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const items = visibleAnnouncements(database, user)
  return (
    <div className="grid gap-3">
      <PageHeader title="Announcements" description="College-wide notes and messages for your courses." />
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-semibold text-navy">{item.title}</h2>
          <p className="mt-2 text-sm">{item.body}</p>
          <p className="mt-2 text-xs text-muted">{formatDateTime(item.publishedAt)}</p>
        </article>
      ))}
    </div>
  )
}

export function StaffAnnouncements() {
  usePageTitle('Announcements')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const courses = user ? visibleCourses(database, user) : []
  const [courseId, setCourseId] = useState(user && canPostSystemAnnouncement(user.role) ? 'system' : courses[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  if (!user) return null
  const items = visibleAnnouncements(database, user)
  return (
    <div className="grid gap-4">
      <PageHeader title="Announcements" description="Course messages reach enrolled students. College-wide messages are for administrators." />
      <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={(event) => {
        event.preventDefault()
        try {
          createAnnouncement(user.id, { courseId: courseId === 'system' ? null : courseId, title, body })
          sync()
          setTitle('')
          setBody('')
          toast.success('Announcement published.')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The announcement could not be published.')
        }
      }}>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="ann-audience">Audience
          <select id="ann-audience" className="h-11 rounded-md border border-line px-3 font-normal" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            {canPostSystemAnnouncement(user.role) ? <option value="system">Whole college</option> : null}
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="ann-title">Title
          <Input id="ann-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="ann-body">Message
          <Textarea id="ann-body" value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <Button type="submit">Publish</Button>
      </form>
      {items.map((item) => {
        const author = userById(database, item.authorUserId)
        return (
          <article key={item.id} className="rounded-lg border border-line bg-white p-4">
            <h2 className="font-semibold text-navy">{item.title}</h2>
            <p className="mt-2 text-sm">{item.body}</p>
            <p className="mt-2 text-xs text-muted">{author ? fullName(author) : 'Staff'} · {formatDateTime(item.publishedAt)}</p>
          </article>
        )
      })}
    </div>
  )
}
