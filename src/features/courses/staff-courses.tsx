import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { DataTable } from '../../components/data-table.tsx'
import { Field } from '../../components/field.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { fullName } from '../../lib/format.ts'
import { canManageCourses, facilitatorNames, visibleCourses } from '../../services/access.ts'
import { createCourse, updateCourse, type CourseInput } from '../../services/api.ts'
import type { Course } from '../../types/index.ts'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a course name.'),
  code: z.string().trim().min(1, 'Enter a course code.'),
  description: z.string(),
  duration: z.string().min(1, 'Enter a duration.'),
  level: z.string().min(1, 'Enter a level.'),
  status: z.enum(['draft', 'active', 'archived']),
  startDate: z.string().min(1, 'Enter a start date.'),
  endDate: z.string().min(1, 'Enter an end date.'),
  passMark: z.coerce.number().int().min(0).max(100),
  facilitatorId: z.string(),
})

type CourseForm = z.infer<typeof schema>

export function StaffCourses() {
  usePageTitle('Courses')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [editing, setEditing] = useState<Course | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<CourseForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      duration: '12 weeks',
      level: 'Beginner',
      status: 'active',
      startDate: '2026-02-02',
      endDate: '2026-04-24',
      passMark: 50,
      facilitatorId: 'none',
    },
  })
  if (!user) return null
  const courses = visibleCourses(database, user)
  const facilitators = database.users.filter((person) => person.role === 'facilitator' && person.status === 'active')
  const canEdit = canManageCourses(user.role)

  const columns: ColumnDef<Course, unknown>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Course' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'passMark', header: 'Pass mark', cell: ({ row }) => `${row.original.passMark}%` },
    {
      id: 'facilitator',
      header: 'Facilitator',
      cell: ({ row }) => facilitatorNames(database, row.original.id).join(', ') || '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canEdit ? (
          <button
            type="button"
            className="font-semibold text-navy underline"
            onClick={() => {
              const course = row.original
              const facilitator = database.courseStaff.find((item) => item.courseId === course.id)
              setEditing(course)
              form.reset({
                name: course.name,
                code: course.code,
                description: course.description,
                duration: course.duration,
                level: course.level,
                status: course.status,
                startDate: course.startDate,
                endDate: course.endDate,
                passMark: course.passMark,
                facilitatorId: facilitator?.staffUserId ?? 'none',
              })
              setOpen(true)
            }}
          >
            Edit
          </button>
        ) : (
          'Assigned'
        ),
    },
  ]

  function save(values: CourseForm) {
    const input: CourseInput = {
      ...values,
      facilitatorId: values.facilitatorId === 'none' ? null : values.facilitatorId,
    }
    try {
      if (editing) updateCourse(user!.id, editing.id, input)
      else createCourse(user!.id, input)
      sync()
      setOpen(false)
      toast.success(editing ? 'Course updated.' : 'Course created.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The course could not be saved.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Course records drive materials, assessments and certificates."
        actions={
          canEdit ? (
            <Button
              onClick={() => {
                setEditing(null)
                form.reset()
                setOpen(true)
              }}
            >
              New course
            </Button>
          ) : null
        }
      />
      <DataTable data={courses} columns={columns} caption="Courses" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit course' : 'New course'}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(save)}>
            <Field label="Name" htmlFor="course-name" error={form.formState.errors.name?.message}>
              <Input id="course-name" {...form.register('name')} />
            </Field>
            <Field label="Code" htmlFor="course-code" error={form.formState.errors.code?.message}>
              <Input id="course-code" {...form.register('code')} />
            </Field>
            <Field label="Description" htmlFor="course-description">
              <Textarea id="course-description" {...form.register('description')} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Duration" htmlFor="course-duration">
                <Input id="course-duration" {...form.register('duration')} />
              </Field>
              <Field label="Level" htmlFor="course-level">
                <Input id="course-level" {...form.register('level')} />
              </Field>
            </div>
            <Field label="Status" htmlFor="course-status">
              <select id="course-status" className="h-11 rounded-md border border-line px-3 text-sm" {...form.register('status')}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" htmlFor="course-start">
                <Input id="course-start" type="date" {...form.register('startDate')} />
              </Field>
              <Field label="Ends" htmlFor="course-end">
                <Input id="course-end" type="date" {...form.register('endDate')} />
              </Field>
            </div>
            <Field label="Pass mark" htmlFor="course-pass">
              <Input id="course-pass" type="number" {...form.register('passMark')} />
            </Field>
            <Field label="Facilitator" htmlFor="course-facilitator">
              <Select value={form.watch('facilitatorId')} onValueChange={(value) => form.setValue('facilitatorId', value)}>
                <SelectTrigger id="course-facilitator" aria-label="Facilitator">
                  <span>{facilitators.find((person) => person.id === form.watch('facilitatorId')) ? fullName(facilitators.find((person) => person.id === form.watch('facilitatorId'))!) : 'No facilitator'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No facilitator</SelectItem>
                  {facilitators.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{fullName(person)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit">Save course</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
