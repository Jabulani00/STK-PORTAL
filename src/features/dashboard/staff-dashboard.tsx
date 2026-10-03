import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '../../components/page-header.tsx'
import { Stat } from '../../components/stat.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Card, CardBody, CardHeader } from '../../components/ui/card.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { attendanceSummary } from '../../lib/attendance.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { canViewAudit, userById, visibleCertificates, visibleCourses, visibleStudents } from '../../services/access.ts'
import { resetDemoData } from '../../services/api.ts'
import { sampleDataEnabled } from '../../services/store.ts'
import { ConfirmDialog } from '../../components/confirm-dialog.tsx'
import { useState } from 'react'
import { toast } from 'sonner'

export function StaffDashboard() {
  usePageTitle('Staff dashboard')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [resetOpen, setResetOpen] = useState(false)
  if (!user) return null
  const courses = visibleCourses(database, user)
  const students = visibleStudents(database, user).filter((student) => student.status === 'active')
  const courseIds = new Set(courses.map((course) => course.id))
  const enrolments = database.enrolments.filter(
    (enrolment) => courseIds.has(enrolment.courseId) && (enrolment.status === 'active' || enrolment.status === 'completed'),
  )
  const completed = enrolments.filter((enrolment) => enrolment.status === 'completed').length
  const certificates = visibleCertificates(database, user)
  const chart = courses.map((course) => ({
    name: course.code,
    students: database.enrolments.filter(
      (enrolment) =>
        enrolment.courseId === course.id && (enrolment.status === 'active' || enrolment.status === 'completed'),
    ).length,
  }))
  const atRisk = students.flatMap((student) => {
    const records = database.attendanceRecords.filter((record) => {
      const session = database.attendanceSessions.find((item) => item.id === record.sessionId)
      return record.studentUserId === student.id && session && courseIds.has(session.courseId)
    })
    const summary = attendanceSummary(records)
    if (summary.percentage === null || summary.percentage >= 80) return []
    return [{ student, percentage: summary.percentage }]
  })

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.firstName}`}
        description="Work that needs a person, not another chart."
        actions={
          <>
            <Button asChild><Link to="/staff/students">Add student</Link></Button>
            <Button asChild variant="outline"><Link to="/staff/materials">Upload material</Link></Button>
            <Button asChild variant="outline"><Link to="/staff/assessments">Create assessment</Link></Button>
            <Button asChild variant="outline"><Link to="/staff/analytics">Analytics</Link></Button>
            <Button asChild variant="accent"><Link to="/staff/certificates">Issue certificates</Link></Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active students" value={String(students.length)} detail="In your courses" />
        <Stat
          label="Completion"
          value={enrolments.length === 0 ? '—' : `${Math.round((completed / enrolments.length) * 100)}%`}
          detail={`${completed} completed enrolments`}
        />
        <Stat label="Valid certificates" value={String(certificates.filter((item) => item.status === 'valid').length)} />
        <Stat label="Revoked certificates" value={String(certificates.filter((item) => item.status === 'revoked').length)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-navy">Students by course</h2>
          </CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="#E4E7EC" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="students" fill="#0F2B5B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-navy">Attendance below 80%</h2>
          </CardHeader>
          <CardBody>
            {atRisk.length === 0 ? <p className="text-sm text-muted">No learner in your courses is under 80% attendance.</p> : null}
            <ul className="grid gap-3">
              {atRisk.map((item) => (
                <li key={item.student.id} className="flex items-center justify-between text-sm">
                  <Link className="font-semibold text-navy underline" to={`/staff/students/${item.student.id}`}>
                    {fullName(item.student)}
                  </Link>
                  <span>{item.percentage}%</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold text-navy">{canViewAudit(user.role) ? 'Recent audit' : 'Recent submissions'}</h2>
        </CardHeader>
        <CardBody>
          {canViewAudit(user.role) ? (
            <ul className="grid gap-3">
              {database.auditLogs.slice(0, 5).map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-semibold">{entry.action}</span>
                  <span className="text-muted"> · {userById(database, entry.actorUserId) ? fullName(userById(database, entry.actorUserId)!) : 'Unknown'} · {formatDateTime(entry.timestamp)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-3">
              {database.assessmentAttempts
                .filter((attempt) => {
                  const assessment = database.assessments.find((item) => item.id === attempt.assessmentId)
                  return assessment && courseIds.has(assessment.courseId) && attempt.submittedAt
                })
                .slice(0, 5)
                .map((attempt) => {
                  const student = userById(database, attempt.studentUserId)
                  const assessment = database.assessments.find((item) => item.id === attempt.assessmentId)
                  return (
                    <li key={attempt.id} className="text-sm">
                      <span className="font-semibold">{student ? fullName(student) : 'Student'}</span>
                      <span className="text-muted"> submitted {assessment?.title} · {formatDateTime(attempt.submittedAt)}</span>
                    </li>
                  )
                })}
            </ul>
          )}
        </CardBody>
      </Card>
      {sampleDataEnabled() ? (
        <div className="mt-4">
          <Button variant="outline" onClick={() => setResetOpen(true)}>Restore demo data</Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restore demo data?"
        description="This replaces everything saved in this browser with the original sample college."
        confirmLabel="Restore"
        tone="danger"
        onConfirm={() => {
          try {
            resetDemoData()
            sync()
            setResetOpen(false)
            toast.success('Demo data restored.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Demo data was not restored.')
          }
        }}
      />
    </div>
  )
}
