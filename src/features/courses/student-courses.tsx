import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/empty-state.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { ProgressBar } from '../../components/progress-bar.tsx'
import { Card, CardBody } from '../../components/ui/card.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { courseProgress, facilitatorNames, visibleCourses } from '../../services/access.ts'

export function StudentCourses() {
  usePageTitle('My courses')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const courses = visibleCourses(database, user)

  return (
    <div>
      <PageHeader title="My courses" description="Only courses you are enrolled in and allowed to open." />
      {courses.length === 0 ? (
        <EmptyState title="No courses yet">When the college enrols you, the course will appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardBody className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase">{course.code} · {course.level}</p>
                  <h2 className="text-lg font-semibold text-navy">{course.name}</h2>
                  <p className="mt-1 text-sm text-muted">{course.description}</p>
                  <p className="mt-2 text-sm text-muted">{facilitatorNames(database, course.id).join(', ') || 'Facilitator to be confirmed'}</p>
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
    </div>
  )
}
