import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Card, CardBody } from '../../components/ui/card.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDate, formatPercent, fullName } from '../../lib/format.ts'
import { canManageSettings, userById, visibleAttempts, visibleCourses } from '../../services/access.ts'
import { saveCourseRules } from '../../services/api.ts'

export function StudentResults() {
  usePageTitle('Results')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const courses = visibleCourses(database, user)
  return (
    <div className="grid gap-4">
      <PageHeader title="Results" description="You only see marks that have been released." />
      {courses.map((course) => {
        const enrolment = database.enrolments.find((item) => item.studentUserId === user.id && item.courseId === course.id)
        const result = enrolment ? database.courseResults.find((item) => item.enrolmentId === enrolment.id) : undefined
        const attempts = database.assessmentAttempts.filter((attempt) => attempt.studentUserId === user.id && database.assessments.some((assessment) => assessment.id === attempt.assessmentId && assessment.courseId === course.id))
        return (
          <Card key={course.id}>
            <CardBody>
              <h2 className="font-semibold text-navy">{course.name}</h2>
              <p className="mt-1 text-sm text-muted">Course result: {result?.status === 'in_progress' || !result ? 'In progress' : `${formatPercent(result.percentage)} · ${result.status}`}</p>
              <ul className="mt-3 grid gap-2">
                {attempts.map((attempt) => {
                  const assessment = database.assessments.find((item) => item.id === attempt.assessmentId)
                  return (
                    <li key={attempt.id} className="text-sm">
                      <Link className="font-semibold text-navy underline" to={`/app/assessments/${attempt.assessmentId}`}>{assessment?.title}</Link>
                      <span className="text-muted"> · {attempt.released ? formatPercent(attempt.percentage) : 'Waiting for review'} · {formatDate(attempt.submittedAt)}</span>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}

export function StaffResults() {
  usePageTitle('Results')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [passMarks, setPassMarks] = useState<Record<string, number>>({})
  if (!user) return null
  const courses = visibleCourses(database, user)
  const attempts = visibleAttempts(database, user).filter((attempt) => attempt.submittedAt)
  return (
    <div className="grid gap-6">
      <PageHeader title="Results" description="Course totals use the weights saved for that course. A result stays in progress until every published assessment is released." />
      {canManageSettings(user.role) ? courses.map((course) => {
        const assessments = database.assessments.filter((assessment) => assessment.courseId === course.id && assessment.status !== 'draft')
        const pass = passMarks[course.id] ?? course.passMark
        return (
          <Card key={course.id}>
            <CardBody className="grid gap-3">
              <h2 className="font-semibold text-navy">{course.name}</h2>
              <label className="grid max-w-xs gap-1 text-sm font-semibold" htmlFor={`pass-${course.id}`}>
                Pass mark
                <input id={`pass-${course.id}`} className="h-11 rounded-md border border-line px-3 font-normal" type="number" value={pass} onChange={(event) => setPassMarks({ ...passMarks, [course.id]: Number(event.target.value) })} />
              </label>
              {assessments.map((assessment) => (
                <label key={assessment.id} className="grid gap-1 text-sm font-semibold md:grid-cols-[1fr_120px]" htmlFor={`weight-${assessment.id}`}>
                  {assessment.title}
                  <input id={`weight-${assessment.id}`} className="h-11 rounded-md border border-line px-3 font-normal" type="number" value={weights[assessment.id] ?? assessment.weight} onChange={(event) => setWeights({ ...weights, [assessment.id]: Number(event.target.value) })} />
                </label>
              ))}
              <Button onClick={() => {
                try {
                  saveCourseRules(user.id, course.id, pass, assessments.map((assessment) => ({ assessmentId: assessment.id, weight: weights[assessment.id] ?? assessment.weight })))
                  sync()
                  toast.success('Course rules saved.')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'The rules could not be saved.')
                }
              }}>Save weights</Button>
            </CardBody>
          </Card>
        )
      }) : <p className="text-sm text-muted">Weight changes are limited to administrators.</p>}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Assessment results</caption>
          <thead className="bg-canvas text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3" scope="col">Student</th>
              <th className="px-4 py-3" scope="col">Assessment</th>
              <th className="px-4 py-3" scope="col">Score</th>
              <th className="px-4 py-3" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => {
              const student = userById(database, attempt.studentUserId)
              const assessment = database.assessments.find((item) => item.id === attempt.assessmentId)
              return (
                <tr key={attempt.id} className="border-t border-line">
                  <td className="px-4 py-3">{student ? fullName(student) : '—'}</td>
                  <td className="px-4 py-3">{assessment?.title}</td>
                  <td className="px-4 py-3">{attempt.percentage === null ? '—' : `${attempt.percentage}%`}</td>
                  <td className="px-4 py-3">{attempt.released ? 'Released' : 'Held'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
