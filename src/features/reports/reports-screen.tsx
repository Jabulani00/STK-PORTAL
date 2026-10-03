import { useState } from 'react'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { attendanceSummary } from '../../lib/attendance.ts'
import { toCsv } from '../../lib/csv.ts'
import { fullName, formatPercent } from '../../lib/format.ts'
import { courseById, studentNumberOf, userById, visibleCertificates, visibleCourses, visibleStudents } from '../../services/access.ts'
import { downloadTextFile } from '../../utils/download.ts'

type ReportKey = 'students' | 'courses' | 'assessments' | 'certificates' | 'attendance'

export function ReportsScreen() {
  usePageTitle('Reports')
  const user = useCurrentUser()
  const database = useDatabase()
  const [report, setReport] = useState<ReportKey>('students')
  if (!user) return null
  const courses = visibleCourses(database, user)
  const courseIds = new Set(courses.map((course) => course.id))
  const rows = reportRows(report, database, user.id, courses.map((course) => course.id))

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Exports include the rows in this view, not a hidden full extract."
        actions={<Button variant="outline" onClick={() => downloadTextFile(`${report}-report.csv`, toCsv(rows), 'text/csv')}>Export CSV</Button>}
      />
      <label className="mb-4 grid max-w-xs gap-1 text-sm font-semibold" htmlFor="report-type">
        Report
        <select id="report-type" className="h-11 rounded-md border border-line px-3 font-normal" value={report} onChange={(event) => setReport(event.target.value as ReportKey)}>
          <option value="students">Students</option>
          <option value="courses">Courses</option>
          <option value="assessments">Assessments</option>
          <option value="certificates">Certificates</option>
          <option value="attendance">Attendance</option>
        </select>
      </label>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{report} report</caption>
          <thead className="bg-canvas text-xs text-muted uppercase">
            <tr>{rows[0]?.map((cell) => <th key={cell} className="px-4 py-3" scope="col">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, index) => (
              <tr key={index} className="border-t border-line">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">{courseIds.size} courses in this report.</p>
    </div>
  )
}

function reportRows(report: ReportKey, database: ReturnType<typeof useDatabase>, userId: string, courseIds: string[]) {
  const actor = userById(database, userId)
  if (!actor) return [['Empty']]
  if (report === 'students') {
    const header = ['Student number', 'Name', 'Email', 'Status']
    const body = visibleStudents(database, actor).map((student) => [studentNumberOf(database, student.id), fullName(student), student.email, student.status])
    return [header, ...body]
  }
  if (report === 'courses') {
    const header = ['Code', 'Course', 'Enrolments', 'Completed']
    const body = visibleCourses(database, actor).map((course) => {
      const enrolments = database.enrolments.filter((item) => item.courseId === course.id)
      return [course.code, course.name, String(enrolments.length), String(enrolments.filter((item) => item.status === 'completed').length)]
    })
    return [header, ...body]
  }
  if (report === 'assessments') {
    const header = ['Assessment', 'Course', 'Average']
    const body = database.assessments.filter((assessment) => courseIds.includes(assessment.courseId)).map((assessment) => {
      const released = database.assessmentAttempts.filter((attempt) => attempt.assessmentId === assessment.id && attempt.released && attempt.percentage !== null)
      const average = released.length === 0 ? '—' : formatPercent(Math.round(released.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) / released.length))
      return [assessment.title, courseById(database, assessment.courseId)?.code ?? '', average]
    })
    return [header, ...body]
  }
  if (report === 'certificates') {
    const header = ['Number', 'Student', 'Course', 'Status']
    const body = visibleCertificates(database, actor).map((certificate) => [certificate.certificateNumber, certificate.studentName, certificate.courseName, certificate.status])
    return [header, ...body]
  }
  const header = ['Student', 'Course', 'Attendance']
  const body = visibleStudents(database, actor).flatMap((student) =>
    visibleCourses(database, actor)
      .filter((course) => database.enrolments.some((enrolment) => enrolment.studentUserId === student.id && enrolment.courseId === course.id))
      .map((course) => {
        const sessions = database.attendanceSessions.filter((session) => session.courseId === course.id)
        const records = database.attendanceRecords.filter((record) => record.studentUserId === student.id && sessions.some((session) => session.id === record.sessionId))
        return [fullName(student), course.name, formatPercent(attendanceSummary(records).percentage)]
      }),
  )
  return [header, ...body]
}
