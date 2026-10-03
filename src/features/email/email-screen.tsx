import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Label } from '../../components/ui/label.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { userById, visibleEmails, visibleStudents } from '../../services/access.ts'
import { sendPortalEmail } from '../../services/api.ts'

const fieldClass = 'h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink'

export function StaffEmailScreen() {
  usePageTitle('Email')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [toUserId, setToUserId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  if (!user) return null
  const students = visibleStudents(database, user)
  const sent = visibleEmails(database, user)

  return (
    <div>
      <PageHeader
        title="Email"
        description="Messages are recorded in the student inbox. This prototype does not connect to a mail server."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="grid gap-3 rounded-lg border border-line bg-white px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            try {
              sendPortalEmail(user.id, toUserId, subject, body)
              setSubject('')
              setBody('')
              sync()
              toast.success('Email recorded in the portal inbox.')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'The email was not recorded.')
            }
          }}
        >
          <h2 className="font-semibold text-navy">Record an email</h2>
          <div>
            <Label htmlFor="email-to">Student</Label>
            <select id="email-to" className={fieldClass} value={toUserId} onChange={(event) => setToUserId(event.target.value)} required>
              <option value="">Choose a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{fullName(student)} · {student.email}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="email-subject">Subject</Label>
            <Input id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="email-body">Message</Label>
            <Textarea id="email-body" value={body} onChange={(event) => setBody(event.target.value)} required />
          </div>
          <Button type="submit">Record email</Button>
        </form>
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 font-semibold text-navy">Recorded mail</h2>
          <ul className="grid gap-3 px-4 py-4">
            {sent.map((email) => {
              const recipient = userById(database, email.toUserId)
              return (
                <li key={email.id} className="rounded-md border border-line px-3 py-3 text-sm">
                  <p className="font-semibold text-navy">{email.subject}</p>
                  <p className="text-muted">To {recipient ? fullName(recipient) : 'Student'} · {formatDateTime(email.createdAt)} · Recorded</p>
                  <p className="mt-2 whitespace-pre-wrap">{email.body}</p>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

export function StudentInboxScreen() {
  usePageTitle('Inbox')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const emails = visibleEmails(database, user)

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Mail recorded by staff appears here. Nothing is sent through an outside mail service in this prototype."
      />
      {emails.length === 0 ? <p className="text-sm text-muted">Your inbox is empty.</p> : null}
      <ul className="grid gap-3">
        {emails.map((email) => {
          const sender = userById(database, email.fromUserId)
          return (
            <li key={email.id} className="rounded-lg border border-line bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-navy">{email.subject}</p>
              <p className="text-muted">From {sender ? fullName(sender) : 'Staff'} · {formatDateTime(email.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap">{email.body}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
