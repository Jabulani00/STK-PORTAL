import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AccessDenied } from '../../components/access-denied.tsx'
import { DataTable } from '../../components/data-table.tsx'
import { Field } from '../../components/field.tsx'
import { ImportWizard } from '../../components/import-wizard.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx'
import { Input } from '../../components/ui/input.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { STUDENT_IMPORT_COLUMNS, validateStudentImport } from '../../lib/csv.ts'
import { formatPercent, fullName, localIsoDate } from '../../lib/format.ts'
import { attendanceForStudent, canChangeAccountStatus, canSeeStudent, courseById, studentNumberOf, userById, visibleCourses, visibleStudents } from '../../services/access.ts'
import { createStudent, importStudents, setAccountStatus, updateStudent } from '../../services/api.ts'
import type { User } from '../../types/index.ts'

const schema = z.object({
  studentNumber: z.string().trim().min(1, 'Enter a student number.'),
  firstName: z.string().trim().min(1, 'Enter a first name.'),
  lastName: z.string().trim().min(1, 'Enter a last name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a phone number.'),
  courseId: z.string(),
  enrolmentDate: z.string(),
})

export function StudentDirectory() {
  usePageTitle('Students')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState('all')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(false)
  const courses = user ? visibleCourses(database, user) : []
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { studentNumber: '', firstName: '', lastName: '', email: '', phone: '', courseId: 'none', enrolmentDate: localIsoDate() },
  })
  const students = useMemo(() => {
    if (!user) return []
    return visibleStudents(database, user).filter((student) => {
      const number = studentNumberOf(database, student.id)
      const haystack = `${fullName(student)} ${student.email} ${number}`.toLowerCase()
      const courseOk = courseId === 'all' || database.enrolments.some((enrolment) => enrolment.studentUserId === student.id && enrolment.courseId === courseId)
      const statusOk = status === 'all' || student.status === status
      return haystack.includes(search.trim().toLowerCase()) && courseOk && statusOk
    })
  }, [courseId, database, search, status, user])
  if (!user) return null
  const columns: ColumnDef<User, unknown>[] = [
    { id: 'number', header: 'Number', accessorFn: (row) => studentNumberOf(database, row.id) },
    { accessorKey: 'lastName', header: 'Name', cell: ({ row }) => <Link className="font-semibold text-navy underline" to={`/staff/students/${row.original.id}`}>{fullName(row.original)}</Link> },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge tone={row.original.status === 'active' ? 'success' : 'neutral'}>{row.original.status}</Badge> },
  ]

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Students"
        description="Search by name, email or student number."
        actions={
          <>
            <Button onClick={() => setOpen(true)}>Add student</Button>
            <Button asChild variant="outline"><Link to="/staff/students/import">Import CSV</Link></Button>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Input aria-label="Search students" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Course filter" className="h-11 rounded-md border border-line bg-white px-3 text-sm" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          <option value="all">All courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
        </select>
        <select aria-label="Status filter" className="h-11 rounded-md border border-line bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <DataTable data={students} columns={columns} caption="Students" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => {
            try {
              createStudent(user.id, { ...values, courseId: values.courseId === 'none' ? null : values.courseId, enrolmentDate: values.enrolmentDate })
              sync()
              setOpen(false)
              form.reset()
              toast.success('Student account created. They sign in with the demo password.')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'The student could not be created.')
            }
          })}>
            <Field label="Student number" htmlFor="new-number" error={form.formState.errors.studentNumber?.message}><Input id="new-number" {...form.register('studentNumber')} /></Field>
            <Field label="First name" htmlFor="new-first" error={form.formState.errors.firstName?.message}><Input id="new-first" {...form.register('firstName')} /></Field>
            <Field label="Last name" htmlFor="new-last" error={form.formState.errors.lastName?.message}><Input id="new-last" {...form.register('lastName')} /></Field>
            <Field label="Email" htmlFor="new-email" error={form.formState.errors.email?.message}><Input id="new-email" type="email" {...form.register('email')} /></Field>
            <Field label="Phone" htmlFor="new-phone" error={form.formState.errors.phone?.message}><Input id="new-phone" {...form.register('phone')} /></Field>
            <Field label="Course" htmlFor="new-course">
              <select id="new-course" className="h-11 rounded-md border border-line px-3 text-sm" {...form.register('courseId')}>
                <option value="none">Enrol later</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </Field>
            <Field label="Enrolment date" htmlFor="new-date"><Input id="new-date" type="date" {...form.register('enrolmentDate')} /></Field>
            <Button type="submit">Create student</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function StudentProfile() {
  const { studentId = '' } = useParams()
  const actor = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const student = userById(database, studentId)
  usePageTitle(student ? fullName(student) : 'Student')
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: student ? {
      studentNumber: studentNumberOf(database, student.id),
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      courseId: 'none',
      enrolmentDate: localIsoDate(),
    } : undefined,
  })
  if (!actor) return null
  if (!student || student.role !== 'student' || !canSeeStudent(database, actor, student.id)) return <AccessDenied home="/staff" />
  const enrolments = database.enrolments.filter((enrolment) => enrolment.studentUserId === student.id && visibleCourses(database, actor).some((course) => course.id === enrolment.courseId))
  const attendance = attendanceForStudent(database, student.id)

  return (
    <div className="grid gap-6">
      <PageHeader title={fullName(student)} description={`${studentNumberOf(database, student.id)} · ${student.email}`} actions={canChangeAccountStatus(actor.role) ? <Button variant="outline" onClick={() => {
        try {
          setAccountStatus(actor.id, student.id, student.status === 'active' ? 'inactive' : 'active')
          sync()
          toast.success(student.status === 'active' ? 'Account deactivated.' : 'Account activated.')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The account could not be updated.')
        }
      }}>{student.status === 'active' ? 'Deactivate' : 'Activate'}</Button> : null} />
      <Badge tone={student.status === 'active' ? 'success' : 'neutral'}>{student.status}</Badge>
      <form className="grid max-w-xl gap-3" onSubmit={form.handleSubmit((values) => {
        try {
          updateStudent(actor.id, student.id, values)
          sync()
          toast.success('Student updated.')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The student could not be updated.')
        }
      })}>
        <Field label="Student number" htmlFor="edit-number"><Input id="edit-number" {...form.register('studentNumber')} /></Field>
        <Field label="First name" htmlFor="edit-first"><Input id="edit-first" {...form.register('firstName')} /></Field>
        <Field label="Last name" htmlFor="edit-last"><Input id="edit-last" {...form.register('lastName')} /></Field>
        <Field label="Email" htmlFor="edit-email"><Input id="edit-email" {...form.register('email')} /></Field>
        <Field label="Phone" htmlFor="edit-phone"><Input id="edit-phone" {...form.register('phone')} /></Field>
        <Button type="submit">Save changes</Button>
      </form>
      <section>
        <h2 className="mb-2 font-semibold text-navy">Enrolments and results</h2>
        <ul className="grid gap-2">
          {enrolments.map((enrolment) => {
            const course = courseById(database, enrolment.courseId)
            const result = database.courseResults.find((item) => item.enrolmentId === enrolment.id)
            return <li key={enrolment.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">{course?.name} · {enrolment.status} · {result ? `${result.status} ${formatPercent(result.percentage)}` : 'No final result'}</li>
          })}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-navy">Attendance</h2>
        <p className="text-sm text-muted">{attendance.summary.percentage === null ? 'No sessions yet.' : `${attendance.summary.percentage}% attending`}</p>
      </section>
    </div>
  )
}

export function StudentImport() {
  usePageTitle('Import students')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  if (!user) return null
  const courses = visibleCourses(database, user)
  return (
    <div>
      <PageHeader title="Import students" description="Validate the file, fix the rows that fail, then import only the valid ones." />
      <ImportWizard
        templateHref="/templates/students-import-template.csv"
        templateFilename="students-import-template.csv"
        templateColumns={STUDENT_IMPORT_COLUMNS}
        onParse={(csv) => {
          const preview = validateStudentImport(csv, {
            studentNumbers: database.studentProfiles.map((profile) => profile.studentNumber),
            emails: database.users.map((account) => account.email),
            courses: courses.map((course) => ({ id: course.id, code: course.code, name: course.name })),
          })
          return {
            headerError: preview.headerError,
            rows: preview.rows.map((row) => ({ rowNumber: row.rowNumber, label: `${row.studentNumber} ${row.firstName} ${row.lastName}`.trim(), errors: row.errors })),
          }
        }}
        onConfirm={(csv) => {
          const preview = validateStudentImport(csv, {
            studentNumbers: database.studentProfiles.map((profile) => profile.studentNumber),
            emails: database.users.map((account) => account.email),
            courses: courses.map((course) => ({ id: course.id, code: course.code, name: course.name })),
          })
          try {
            const count = importStudents(user.id, preview.rows)
            sync()
            return count
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The import did not finish.')
            return 0
          }
        }}
      />
    </div>
  )
}
