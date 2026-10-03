import { useState } from 'react'
import { toast } from 'sonner'
import { ImportWizard } from '../../components/import-wizard.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Label } from '../../components/ui/label.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { TICKET_IMPORT_COLUMNS, toCsv, validateTicketImport } from '../../lib/csv.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { downloadTextFile } from '../../utils/download.ts'
import { courseById, studentNumberOf, userById, visibleCourses, visibleStudents, visibleTickets } from '../../services/access.ts'
import { createTicket, importTickets, replyToTicket, setTicketStatus } from '../../services/api.ts'
import type { TicketCategory, TicketStatus } from '../../types/index.ts'

const fieldClass = 'h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink'
const categories: { value: TicketCategory; label: string }[] = [
  { value: 'access', label: 'Access' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
]
const statuses: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

function statusTone(status: TicketStatus) {
  if (status === 'resolved') return 'success' as const
  if (status === 'in_progress') return 'gold' as const
  return 'danger' as const
}

export function TicketsScreen() {
  const user = useCurrentUser()
  usePageTitle(user?.role === 'student' ? 'Support' : 'Tickets')
  const database = useDatabase()
  const sync = useSyncPortal()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<TicketCategory>('technical')
  const [courseId, setCourseId] = useState('')
  const [replies, setReplies] = useState<Record<string, string>>({})
  if (!user) return null

  const tickets = visibleTickets(database, user).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const courses = visibleCourses(database, user)
  const staff = user.role !== 'student'

  function exportTickets() {
    const rows = [
      ['Student number', 'Student', 'Subject', 'Category', 'Course', 'Status', 'Details'],
      ...tickets.map((ticket) => {
        const reporter = userById(database, ticket.reporterUserId)
        const course = ticket.courseId ? courseById(database, ticket.courseId) : null
        return [
          studentNumberOf(database, ticket.reporterUserId),
          reporter ? fullName(reporter) : '',
          ticket.subject,
          ticket.category,
          course?.code ?? '',
          ticket.status,
          ticket.body,
        ]
      }),
    ]
    downloadTextFile('stk-tickets.csv', toCsv(rows), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        title={staff ? 'Tickets' : 'Support'}
        description="Report an access, assessment, certificate, or technical issue. Staff can reply, change the status, and exchange tickets as CSV."
        actions={<Button variant="outline" onClick={exportTickets}>Export CSV</Button>}
      />
      {user.role === 'student' ? (
        <form
          className="mb-6 grid gap-3 rounded-lg border border-line bg-white px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            try {
              createTicket(user.id, { subject, body, category, courseId: courseId || null })
              setSubject('')
              setBody('')
              sync()
              toast.success('Ticket opened.')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'The ticket was not opened.')
            }
          }}
        >
          <h2 className="font-semibold text-navy">Report an issue</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="ticket-category">Category</Label>
              <select id="ticket-category" className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)}>
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="ticket-course">Course</Label>
            <select id="ticket-course" className={fieldClass} value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">College-wide</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="ticket-body">Details</Label>
            <Textarea id="ticket-body" value={body} onChange={(event) => setBody(event.target.value)} required />
          </div>
          <Button type="submit">Open ticket</Button>
        </form>
      ) : (
        <div className="mb-6">
          <ImportWizard
            templateHref="/templates/tickets-import-template.csv"
            templateFilename="tickets-import-template.csv"
            templateColumns={TICKET_IMPORT_COLUMNS}
            onParse={(csv) => {
              const preview = validateTicketImport(csv, {
                students: visibleStudents(database, user).map((student) => ({
                  userId: student.id,
                  studentNumber: studentNumberOf(database, student.id),
                  name: fullName(student),
                })),
                courses: courses.map((course) => ({ id: course.id, code: course.code, name: course.name })),
              })
              return {
                headerError: preview.headerError,
                rows: preview.rows.map((row) => ({
                  rowNumber: row.rowNumber,
                  label: `${row.studentNumber} ${row.subject}`.trim(),
                  errors: row.errors,
                })),
              }
            }}
            onConfirm={(csv) => {
              const preview = validateTicketImport(csv, {
                students: visibleStudents(database, user).map((student) => ({
                  userId: student.id,
                  studentNumber: studentNumberOf(database, student.id),
                  name: fullName(student),
                })),
                courses: courses.map((course) => ({ id: course.id, code: course.code, name: course.name })),
              })
              const count = importTickets(user.id, preview.rows)
              sync()
              return count
            }}
          />
        </div>
      )}
      <ul className="grid gap-4">
        {tickets.map((ticket) => {
          const reporter = userById(database, ticket.reporterUserId)
          const course = ticket.courseId ? courseById(database, ticket.courseId) : null
          const thread = database.ticketReplies.filter((reply) => reply.ticketId === ticket.id)
          return (
            <li key={ticket.id} className="rounded-lg border border-line bg-white px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-navy">{ticket.subject}</h2>
                <Badge tone={statusTone(ticket.status)}>{statuses.find((item) => item.value === ticket.status)?.label}</Badge>
                <Badge>{categories.find((item) => item.value === ticket.category)?.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {reporter ? fullName(reporter) : 'Student'}
                {course ? ` · ${course.code}` : ''}
                {' · '}
                {formatDateTime(ticket.updatedAt)}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{ticket.body}</p>
              <ul className="mt-3 grid gap-2">
                {thread.map((reply) => {
                  const author = userById(database, reply.authorUserId)
                  return (
                    <li key={reply.id} className="rounded-md bg-canvas px-3 py-2 text-sm">
                      <p className="font-semibold text-navy">{author ? fullName(author) : 'User'}</p>
                      <p className="whitespace-pre-wrap">{reply.body}</p>
                    </li>
                  )
                })}
              </ul>
              <form
                className="mt-3 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  try {
                    replyToTicket(user.id, ticket.id, replies[ticket.id] ?? '')
                    setReplies((current) => ({ ...current, [ticket.id]: '' }))
                    sync()
                    toast.success('Reply saved.')
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'The reply was not saved.')
                  }
                }}
              >
                <Label htmlFor={`reply-${ticket.id}`}>Reply</Label>
                <Textarea
                  id={`reply-${ticket.id}`}
                  value={replies[ticket.id] ?? ''}
                  onChange={(event) => setReplies((current) => ({ ...current, [ticket.id]: event.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="outline">Reply</Button>
                  {staff
                    ? statuses.map((item) => (
                        <Button
                          key={item.value}
                          type="button"
                          variant={ticket.status === item.value ? 'primary' : 'ghost'}
                          onClick={() => {
                            try {
                              setTicketStatus(user.id, ticket.id, item.value)
                              sync()
                              toast.success('Status updated.')
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'The status was not updated.')
                            }
                          }}
                        >
                          {item.label}
                        </Button>
                      ))
                    : null}
                </div>
              </form>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
