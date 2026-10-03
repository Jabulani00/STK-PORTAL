import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Label } from '../../components/ui/label.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { courseById, userById, visibleCourses, visibleStudents, visibleThreads } from '../../services/access.ts'
import { sendChatMessage, startConversation } from '../../services/api.ts'
import { portalStore } from '../../services/store.ts'

const fieldClass = 'h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink'

export function MessagesScreen() {
  usePageTitle('Messages')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [selectedId, setSelectedId] = useState('')
  const [reply, setReply] = useState('')
  const [courseId, setCourseId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [draft, setDraft] = useState('')
  if (!user) return null
  const actor = user

  const threads = visibleThreads(database, user)
  const active = threads.find((thread) => thread.id === selectedId) ?? threads[0]
  const courses = visibleCourses(database, user)
  const students = visibleStudents(database, user)
  const messages = active
    ? database.chatMessages
        .filter((message) => message.threadId === active.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    : []

  function sendReply() {
    if (!active) return
    try {
      sendChatMessage(actor.id, active.id, reply)
      setReply('')
      sync()
      toast.success('Message sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The message was not sent.')
    }
  }

  function start() {
    try {
      startConversation(actor.id, courseId, draft, studentId || undefined)
      setDraft('')
      sync()
      const latest = [...portalStore.get().chatMessages].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      if (latest) setSelectedId(latest.threadId)
      toast.success('Conversation started.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The conversation was not started.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Course conversations stay inside the portal. A student reaches the facilitator assigned to that course."
      />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-white">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Conversations</p>
          {threads.length === 0 ? <p className="px-4 py-3 text-sm text-muted">No conversations yet.</p> : null}
          <ul>
            {threads.map((thread) => {
              const course = thread.courseId ? courseById(database, thread.courseId) : null
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left text-sm ${active?.id === thread.id ? 'bg-info-soft font-semibold text-navy' : 'hover:bg-canvas'}`}
                    onClick={() => setSelectedId(thread.id)}
                  >
                    <span className="block">{thread.subject}</span>
                    <span className="block text-xs font-normal text-muted">{course?.code ?? 'Course'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="grid gap-4">
          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-semibold text-navy">{active?.subject ?? 'Start a conversation'}</h2>
            </div>
            <div className="grid max-h-80 gap-3 overflow-auto px-4 py-4">
              {messages.map((message) => {
                const sender = userById(database, message.senderUserId)
                const mine = message.senderUserId === actor.id
                return (
                  <article key={message.id} className={`max-w-xl rounded-lg px-3 py-2 text-sm ${mine ? 'ml-auto bg-navy text-white' : 'bg-canvas text-ink'}`}>
                    <p className={`text-xs font-semibold ${mine ? 'text-gold' : 'text-navy'}`}>{sender ? fullName(sender) : 'User'}</p>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-xs ${mine ? 'text-white/70' : 'text-muted'}`}>{formatDateTime(message.createdAt)}</p>
                  </article>
                )
              })}
            </div>
            {active ? (
              <form
                className="grid gap-3 border-t border-line px-4 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendReply()
                }}
              >
                <Label htmlFor="reply">Reply</Label>
                <Textarea id="reply" value={reply} onChange={(event) => setReply(event.target.value)} />
                <Button type="submit">Send</Button>
              </form>
            ) : null}
          </section>
          <section className="rounded-lg border border-line bg-white px-4 py-4">
            <h2 className="font-semibold text-navy">New conversation</h2>
            <form
              className="mt-3 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                start()
              }}
            >
              <div>
                <Label htmlFor="chat-course">Course</Label>
                <select id="chat-course" className={fieldClass} value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.code} · {course.name}</option>
                  ))}
                </select>
              </div>
              {actor.role !== 'student' ? (
                <div>
                  <Label htmlFor="chat-student">Student</Label>
                  <select id="chat-student" className={fieldClass} value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
                    <option value="">Choose a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>{fullName(student)}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <Label htmlFor="chat-body">Message</Label>
                <Textarea id="chat-body" value={draft} onChange={(event) => setDraft(event.target.value)} required />
              </div>
              <Button type="submit">Start conversation</Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
