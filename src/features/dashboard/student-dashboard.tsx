import { Link } from 'react-router-dom'
import { Callout } from '../../components/callout.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { ProgressBar } from '../../components/progress-bar.tsx'
import { Card, CardBody } from '../../components/ui/card.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { assessmentWindow } from '../../lib/assessment-window.ts'
import { formatDate, fullName } from '../../lib/format.ts'
import {
  courseById,
  courseProgress,
  facilitatorNames,
  visibleAnnouncements,
  visibleAssessments,
  visibleCertificates,
  visibleCourses,
} from '../../services/access.ts'

export function StudentDashboard() {
  usePageTitle('Home')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const courses = visibleCourses(database, user)
  const assessments = visibleAssessments(database, user).filter((assessment) => {
    const window = assessmentWindow(assessment)
    const released = database.assessmentAttempts.some(
      (attempt) => attempt.assessmentId === assessment.id && attempt.studentUserId === user.id && attempt.released,
    )
    return window === 'open' && !released
  })
  const results = database.assessmentAttempts
    .filter((attempt) => attempt.studentUserId === user.id && attempt.released && attempt.percentage !== null)
    .slice(0, 3)
  const certificates = visibleCertificates(database, user)
  const announcements = visibleAnnouncements(database, user).slice(0, 3)

  return (
    <div>
      <PageHeader title={`Welcome, ${user.firstName}`} description="Your courses, assessments and certificates." />
      {courses.length === 0 ? (
        <Callout>You are not enrolled in an active course yet. The college office can add you.</Callout>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardBody className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{course.code}</p>
                  <h2 className="text-lg font-semibold text-navy">{course.name}</h2>
                  <p className="text-sm text-muted">{facilitatorNames(database, course.id).join(', ') || 'Facilitator to be confirmed'}</p>
                </div>
                <ProgressBar value={courseProgress(database, user.id, course.id)} label="Progress" />
                <Link className="text-sm font-semibold text-navy underline" to={`/app/courses/${course.id}`}>
                  Continue
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody>
            <h2 className="font-semibold text-navy">Upcoming assessments</h2>
            <ul className="mt-3 grid gap-3">
              {assessments.length === 0 ? <li className="text-sm text-muted">Nothing is waiting right now.</li> : null}
              {assessments.slice(0, 4).map((assessment) => (
                <li key={assessment.id}>
                  <Link className="font-semibold text-navy underline" to={`/app/assessments/${assessment.id}`}>
                    {assessment.title}
                  </Link>
                  <p className="text-xs text-muted">{courseById(database, assessment.courseId)?.code} · closes {formatDate(assessment.availableUntil)}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="font-semibold text-navy">Recent results</h2>
            <ul className="mt-3 grid gap-3">
              {results.length === 0 ? <li className="text-sm text-muted">Released results will appear here.</li> : null}
              {results.map((attempt) => {
                const assessment = database.assessments.find((item) => item.id === attempt.assessmentId)
                return (
                  <li key={attempt.id} className="text-sm">
                    <span className="font-semibold">{assessment?.title}</span>
                    <span className="block text-muted">{attempt.percentage}% · {formatDate(attempt.submittedAt)}</span>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="font-semibold text-navy">Certificates</h2>
            <p className="mt-3 text-sm text-muted">
              {certificates.filter((item) => item.status === 'valid').length} valid ·{' '}
              {certificates.filter((item) => item.status === 'revoked').length} revoked
            </p>
            <Link className="mt-3 inline-block text-sm font-semibold text-navy underline" to="/app/certificates">
              View certificates
            </Link>
            <h3 className="mt-5 font-semibold text-navy">Announcements</h3>
            <ul className="mt-2 grid gap-2">
              {announcements.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-semibold">{item.title}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">Signed in as {fullName(user)}.</p>
    </div>
  )
}
