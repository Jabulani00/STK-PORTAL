import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { DataTable } from '../../components/data-table.tsx'
import { Field } from '../../components/field.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDate, fullName, localIsoDate } from '../../lib/format.ts'
import { enrolmentStatusLabels } from '../../lib/labels.ts'
import { courseById, studentNumberOf, userById, visibleCourses, visibleStudents } from '../../services/access.ts'
import { enrolStudent, setEnrolmentStatus } from '../../services/api.ts'
import type { Enrolment, EnrolmentStatus } from '../../types/index.ts'
import type { ColumnDef } from '@tanstack/react-table'

const schema = z.object({
  studentUserId: z.string().min(1, 'Choose a student.'),
  courseId: z.string().min(1, 'Choose a course.'),
  enrolmentDate: z.string().min(1, 'Enter a date.'),
})

export function EnrolmentsScreen() {
  usePageTitle('Enrolments')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { studentUserId: '', courseId: '', enrolmentDate: localIsoDate() },
  })
  if (!user) return null
  const courses = visibleCourses(database, user)
  const students = visibleStudents(database, user)
  const rows = database.enrolments.filter((enrolment) => courses.some((course) => course.id === enrolment.courseId))
  const columns: ColumnDef<Enrolment, unknown>[] = [
    {
      id: 'student',
      header: 'Student',
      accessorFn: (row) => {
        const student = userById(database, row.studentUserId)
        return student ? fullName(student) : ''
      },
    },
    {
      id: 'number',
      header: 'Number',
      cell: ({ row }) => studentNumberOf(database, row.original.studentUserId),
    },
    {
      id: 'course',
      header: 'Course',
      cell: ({ row }) => courseById(database, row.original.courseId)?.name ?? '—',
    },
    { accessorKey: 'enrolledAt', header: 'Enrolled', cell: ({ row }) => formatDate(row.original.enrolledAt) },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <select
          aria-label={`Status for ${studentNumberOf(database, row.original.studentUserId)}`}
          className="h-9 rounded-md border border-line bg-white px-2 text-sm"
          value={row.original.status}
          onChange={(event) => {
            try {
              setEnrolmentStatus(user.id, row.original.id, event.target.value as EnrolmentStatus)
              sync()
              toast.success('Enrolment updated.')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'The enrolment could not be updated.')
            }
          }}
        >
          {(Object.keys(enrolmentStatusLabels) as EnrolmentStatus[]).map((status) => (
            <option key={status} value={status}>{enrolmentStatusLabels[status]}</option>
          ))}
        </select>
      ),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title="Enrolments" description="Enrol a student or suspend an enrolment without deleting their history." />
      <form
        className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-4"
        onSubmit={form.handleSubmit((values) => {
          try {
            enrolStudent(user.id, values.studentUserId, values.courseId, values.enrolmentDate)
            sync()
            toast.success('Student enrolled.')
            form.reset({ ...values, studentUserId: '' })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The student could not be enrolled.')
          }
        })}
      >
        <Field label="Student" htmlFor="enrol-student" error={form.formState.errors.studentUserId?.message}>
          <Select value={form.watch('studentUserId') || undefined} onValueChange={(value) => form.setValue('studentUserId', value)}>
            <SelectTrigger id="enrol-student" aria-label="Student" />
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>{fullName(student)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Course" htmlFor="enrol-course" error={form.formState.errors.courseId?.message}>
          <Select value={form.watch('courseId') || undefined} onValueChange={(value) => form.setValue('courseId', value)}>
            <SelectTrigger id="enrol-course" aria-label="Course" />
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date" htmlFor="enrol-date">
          <Input id="enrol-date" type="date" {...form.register('enrolmentDate')} />
        </Field>
        <div className="flex items-end">
          <Button type="submit">Enrol</Button>
        </div>
      </form>
      <DataTable data={rows} columns={columns} caption="Enrolments" />
      <p className="text-sm text-muted">
        Suspended and withdrawn enrolments keep results. <Badge tone="navy">Active</Badge> and completed enrolments can open the course.
      </p>
    </div>
  )
}
