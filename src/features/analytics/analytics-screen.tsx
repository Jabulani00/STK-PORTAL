import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Card, CardBody, CardHeader } from '../../components/ui/card.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { attendanceSummary } from '../../lib/attendance.ts'
import { toCsv } from '../../lib/csv.ts'
import { downloadTextFile } from '../../utils/download.ts'
import { visibleCourses, visibleTickets } from '../../services/access.ts'

const NAVY = '#0F2B5B'
const GOLD = '#F4C542'
const EMBER = '#E85D04'
const SIGNAL = '#C1121F'

export function AnalyticsScreen() {
  usePageTitle('Analytics')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null

  const courses = visibleCourses(database, user)
  const courseIds = new Set(courses.map((course) => course.id))
  const enrolments = courses.map((course) => ({
    name: course.code,
    students: database.enrolments.filter(
      (enrolment) =>
        enrolment.courseId === course.id && (enrolment.status === 'active' || enrolment.status === 'completed'),
    ).length,
  }))
  const results = database.courseResults.filter((result) => {
    const enrolment = database.enrolments.find((item) => item.id === result.enrolmentId)
    return enrolment && courseIds.has(enrolment.courseId) && result.percentage !== null
  })
  const bands = [
    { name: '0–49', count: results.filter((result) => (result.percentage ?? 0) < 50).length },
    { name: '50–69', count: results.filter((result) => (result.percentage ?? 0) >= 50 && (result.percentage ?? 0) < 70).length },
    { name: '70–100', count: results.filter((result) => (result.percentage ?? 0) >= 70).length },
  ]
  const attendance = courses.map((course) => {
    const sessionIds = new Set(database.attendanceSessions.filter((session) => session.courseId === course.id).map((session) => session.id))
    const summary = attendanceSummary(database.attendanceRecords.filter((record) => sessionIds.has(record.sessionId)))
    return { name: course.code, rate: summary.percentage ?? 0 }
  })
  const assessmentAverages = courses.map((course) => {
    const assessmentIds = new Set(database.assessments.filter((assessment) => assessment.courseId === course.id).map((assessment) => assessment.id))
    const released = database.assessmentAttempts.filter(
      (attempt) => assessmentIds.has(attempt.assessmentId) && attempt.released && attempt.percentage !== null,
    )
    const average = released.length === 0 ? 0 : Math.round(released.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) / released.length)
    return { name: course.code, average }
  })
  const tickets = visibleTickets(database, user)
  const ticketChart = [
    { name: 'Open', value: tickets.filter((ticket) => ticket.status === 'open').length, fill: SIGNAL },
    { name: 'In progress', value: tickets.filter((ticket) => ticket.status === 'in_progress').length, fill: EMBER },
    { name: 'Resolved', value: tickets.filter((ticket) => ticket.status === 'resolved').length, fill: NAVY },
  ]

  function exportCharts() {
    const rows = [
      ['Chart', 'Label', 'Value'],
      ...enrolments.map((row) => ['Enrolments', row.name, String(row.students)]),
      ...bands.map((row) => ['Result band', row.name, String(row.count)]),
      ...attendance.map((row) => ['Attendance %', row.name, String(row.rate)]),
      ...assessmentAverages.map((row) => ['Assessment average', row.name, String(row.average)]),
      ...ticketChart.map((row) => ['Tickets', row.name, String(row.value)]),
    ]
    downloadTextFile('stk-analytics.csv', toCsv(rows), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Enrolments, results, attendance, assessment averages, and support tickets for the courses you can see."
        actions={<Button variant="outline" onClick={exportCharts}>Export CSV</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold text-navy">Students by course</h2></CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrolments}>
                <CartesianGrid stroke="#E4E7EC" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="students" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold text-navy">Result bands</h2></CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bands}>
                <CartesianGrid stroke="#E4E7EC" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold text-navy">Attendance rate</h2></CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendance}>
                <CartesianGrid stroke="#E4E7EC" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="rate" fill={EMBER} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold text-navy">Released assessment average</h2></CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assessmentAverages}>
                <CartesianGrid stroke="#E4E7EC" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5C6B80', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="average" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><h2 className="font-semibold text-navy">Tickets</h2></CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ticketChart} dataKey="value" nameKey="name" outerRadius={90}>
                  {ticketChart.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
