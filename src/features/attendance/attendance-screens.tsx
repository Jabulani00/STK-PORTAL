import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { attendanceSummary } from '../../lib/attendance.ts'
import { formatDate, fullName, localIsoDate } from '../../lib/format.ts'
import { courseById, userById, visibleCourses } from '../../services/access.ts'
import { createSession, saveAttendance } from '../../services/api.ts'
import type { AttendanceStatus } from '../../types/index.ts'

const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export function StudentAttendance() {
  usePageTitle('Attendance')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const courses = visibleCourses(database, user)
  return (
    <div className="grid gap-4">
      <PageHeader title="Attendance" description="Your own attendance for enrolled courses." />
      {courses.map((course) => {
        const sessions = database.attendanceSessions.filter((session) => session.courseId === course.id)
        const records = database.attendanceRecords.filter((record) => record.studentUserId === user.id && sessions.some((session) => session.id === record.sessionId))
        const summary = attendanceSummary(records)
        return (
          <section key={course.id} className="rounded-lg border border-line bg-white p-4">
            <h2 className="font-semibold text-navy">{course.name}</h2>
            <p className="mt-1 text-sm text-muted">{summary.percentage === null ? 'No sessions recorded.' : `${summary.percentage}% attending`}</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {sessions.map((session) => {
                const record = records.find((item) => item.sessionId === session.id)
                return <li key={session.id}>{formatDate(session.date)} · {session.title} · {record?.status ?? 'Not marked'}</li>
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function StaffAttendance() {
  usePageTitle('Attendance')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const courses = user ? visibleCourses(database, user) : []
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const sessions = database.attendanceSessions.filter((session) => session.courseId === (courseId || courses[0]?.id))
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(localIsoDate())
  const selectedCourse = courseId || courses[0]?.id || ''
  const selectedSession = sessionId || sessions[0]?.id || ''
  const learners = database.enrolments.filter((enrolment) => enrolment.courseId === selectedCourse && enrolment.status !== 'withdrawn')
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  if (!user) return null

  return (
    <div className="grid gap-4">
      <PageHeader title="Attendance" description="Record a session, then mark every learner before you save." />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold" htmlFor="att-course">Course
          <select id="att-course" className="h-11 rounded-md border border-line px-3 font-normal" value={selectedCourse} onChange={(event) => { setCourseId(event.target.value); setSessionId('') }}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="att-session">Session
          <select id="att-session" className="h-11 rounded-md border border-line px-3 font-normal" value={selectedSession} onChange={(event) => setSessionId(event.target.value)}>
            {sessions.map((session) => <option key={session.id} value={session.id}>{formatDate(session.date)} · {session.title}</option>)}
          </select>
        </label>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault()
        try {
          const id = createSession(user.id, selectedCourse, title, date)
          sync()
          setSessionId(id)
          setTitle('')
          toast.success('Session added.')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The session could not be added.')
        }
      }}>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="session-title">New session
          <Input id="session-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <Input aria-label="Session date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Button type="submit">Add session</Button>
      </form>
      {selectedSession ? (
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault()
          try {
            saveAttendance(user.id, selectedSession, learners.map((enrolment) => ({
              studentUserId: enrolment.studentUserId,
              status: marks[enrolment.studentUserId] ?? database.attendanceRecords.find((record) => record.sessionId === selectedSession && record.studentUserId === enrolment.studentUserId)?.status ?? 'present',
            })))
            sync()
            toast.success('Attendance saved.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Attendance could not be saved.')
          }
        }}>
          {learners.map((enrolment) => {
            const student = userById(database, enrolment.studentUserId)
            const current = marks[enrolment.studentUserId] ?? database.attendanceRecords.find((record) => record.sessionId === selectedSession && record.studentUserId === enrolment.studentUserId)?.status ?? 'present'
            return (
              <label key={enrolment.id} className="grid items-center gap-2 rounded-lg border border-line bg-white p-3 text-sm md:grid-cols-[1fr_180px]">
                <span className="font-semibold">{student ? fullName(student) : 'Student'}</span>
                <select aria-label={`Attendance for ${student ? fullName(student) : 'student'}`} className="h-11 rounded-md border border-line px-3" value={current} onChange={(event) => setMarks({ ...marks, [enrolment.studentUserId]: event.target.value as AttendanceStatus })}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            )
          })}
          <Button type="submit">Save attendance</Button>
        </form>
      ) : <p className="text-sm text-muted">Add a session for {courseById(database, selectedCourse)?.name}.</p>}
    </div>
  )
}
