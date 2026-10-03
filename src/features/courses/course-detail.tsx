import { Link, useParams } from 'react-router-dom'
import { AccessDenied } from '../../components/access-denied.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { ProgressBar } from '../../components/progress-bar.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Card, CardBody } from '../../components/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { assessmentWindow } from '../../lib/assessment-window.ts'
import { formatDate } from '../../lib/format.ts'
import { assessmentTypeLabels, materialCategoryLabels } from '../../lib/labels.ts'
import {
  canAccessCourse,
  courseById,
  courseProgress,
  facilitatorNames,
  visibleAnnouncements,
  visibleAssessments,
  visibleMaterials,
} from '../../services/access.ts'

export function CourseDetail() {
  const { courseId = '' } = useParams()
  const user = useCurrentUser()
  const database = useDatabase()
  const course = courseById(database, courseId)
  usePageTitle(course?.name ?? 'Course')
  if (!user) return null
  if (!course || !canAccessCourse(database, user, course.id)) return <AccessDenied home="/app" />

  const materials = visibleMaterials(database, user, course.id).slice(0, 4)
  const assessments = visibleAssessments(database, user, course.id)
  const announcements = visibleAnnouncements(database, user).filter((item) => item.courseId === course.id)
  const result = database.courseResults.find((item) => {
    const enrolment = database.enrolments.find((entry) => entry.id === item.enrolmentId)
    return enrolment?.studentUserId === user.id && enrolment.courseId === course.id
  })

  return (
    <div>
      <PageHeader title={course.name} description={`${course.code} · ${course.duration} · ${facilitatorNames(database, course.id).join(', ') || 'Facilitator to be confirmed'}`} />
      <ProgressBar value={courseProgress(database, user.id, course.id)} label="Course progress" />
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="max-w-2xl text-sm leading-6">{course.description}</p>
          <p className="mt-3 text-sm text-muted">
            Pass mark {course.passMark}%. Course result:{' '}
            {result?.status === 'pass' || result?.status === 'fail' ? `${result.percentage}% · ${result.status}` : 'In progress'}
          </p>
        </TabsContent>
        <TabsContent value="materials" className="grid gap-3">
          {materials.map((material) => (
            <Card key={material.id}>
              <CardBody>
                <Badge>{materialCategoryLabels[material.category]}</Badge>
                <h2 className="mt-2 font-semibold text-navy">{material.title}</h2>
                <p className="text-sm text-muted">{material.description}</p>
              </CardBody>
            </Card>
          ))}
          <Link className="text-sm font-semibold text-navy underline" to={`/app/courses/${course.id}/materials`}>
            Open all materials
          </Link>
        </TabsContent>
        <TabsContent value="assessments" className="grid gap-3">
          {assessments.map((assessment) => (
            <Card key={assessment.id}>
              <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase">{assessmentTypeLabels[assessment.type]} · {assessment.weight}%</p>
                  <h2 className="font-semibold text-navy">{assessment.title}</h2>
                  <p className="text-sm text-muted">{assessmentWindow(assessment)} · until {formatDate(assessment.availableUntil)}</p>
                </div>
                <Link className="text-sm font-semibold text-navy underline" to={`/app/assessments/${assessment.id}`}>
                  Open
                </Link>
              </CardBody>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="announcements" className="grid gap-3">
          {announcements.length === 0 ? <p className="text-sm text-muted">No course announcements yet.</p> : null}
          {announcements.map((item) => (
            <Card key={item.id}>
              <CardBody>
                <h2 className="font-semibold text-navy">{item.title}</h2>
                <p className="mt-1 text-sm">{item.body}</p>
                <p className="mt-2 text-xs text-muted">{formatDate(item.publishedAt)}</p>
              </CardBody>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
