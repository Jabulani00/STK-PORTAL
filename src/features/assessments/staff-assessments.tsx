import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AccessDenied } from '../../components/access-denied.tsx'
import { DataTable } from '../../components/data-table.tsx'
import { Field } from '../../components/field.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Checkbox } from '../../components/ui/checkbox.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { assessmentTypeLabels, attemptStatusLabels, questionTypeLabels } from '../../lib/labels.ts'
import { canAccessCourse, courseById, userById, visibleAssessments, visibleCourses } from '../../services/access.ts'
import { addQuestion, createAssessment, releaseAttempt, saveManualMark, setAssessmentStatus } from '../../services/api.ts'
import type { Assessment, QuestionType } from '../../types/index.ts'

const assessmentSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(1, 'Enter a title.'),
  type: z.enum(['quiz', 'assignment', 'test', 'final']),
  instructions: z.string(),
  weight: z.coerce.number().int().min(0).max(100),
  timeLimitMinutes: z.string(),
  maxAttempts: z.coerce.number().int().min(1),
  resultRelease: z.enum(['immediate', 'after_review']),
})

export function StaffAssessments() {
  usePageTitle('Assessments')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const courses = user ? visibleCourses(database, user) : []
  const form = useForm<z.infer<typeof assessmentSchema>>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      courseId: courses[0]?.id ?? '',
      title: '',
      type: 'quiz',
      instructions: '',
      weight: 10,
      timeLimitMinutes: '',
      maxAttempts: 1,
      resultRelease: 'immediate',
    },
  })
  if (!user) return null
  const assessments = visibleAssessments(database, user)
  const columns: ColumnDef<Assessment, unknown>[] = [
    { accessorKey: 'title', header: 'Assessment', cell: ({ row }) => <Link className="font-semibold text-navy underline" to={`/staff/assessments/${row.original.id}`}>{row.original.title}</Link> },
    { id: 'course', header: 'Course', cell: ({ row }) => courseById(database, row.original.courseId)?.code ?? '—' },
    { accessorKey: 'weight', header: 'Weight', cell: ({ row }) => `${row.original.weight}%` },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'queue',
      header: 'Waiting',
      cell: ({ row }) =>
        String(database.assessmentAttempts.filter((attempt) => attempt.assessmentId === row.original.id && attempt.status === 'submitted').length),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title="Assessments" description="Build a quiz, publish it, then mark anything the system cannot mark itself." />
      <form
        className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-2"
        onSubmit={form.handleSubmit((values) => {
          try {
            const id = createAssessment(user.id, {
              ...values,
              timeLimitMinutes: values.timeLimitMinutes ? Number(values.timeLimitMinutes) : null,
            })
            sync()
            toast.success('Assessment draft created.')
            form.reset()
            window.location.assign(`/staff/assessments/${id}`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The assessment could not be created.')
          }
        })}
      >
        <Field label="Course" htmlFor="assessment-course">
          <select id="assessment-course" className="h-11 rounded-md border border-line px-3 text-sm" {...form.register('courseId')}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </Field>
        <Field label="Title" htmlFor="assessment-title" error={form.formState.errors.title?.message}>
          <Input id="assessment-title" {...form.register('title')} />
        </Field>
        <Field label="Type" htmlFor="assessment-type">
          <select id="assessment-type" className="h-11 rounded-md border border-line px-3 text-sm" {...form.register('type')}>
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="test">Test</option>
            <option value="final">Final assessment</option>
          </select>
        </Field>
        <Field label="Weight" htmlFor="assessment-weight">
          <Input id="assessment-weight" type="number" {...form.register('weight')} />
        </Field>
        <Field label="Minutes" htmlFor="assessment-minutes" hint="Leave blank for no limit.">
          <Input id="assessment-minutes" type="number" {...form.register('timeLimitMinutes')} />
        </Field>
        <Field label="Attempts" htmlFor="assessment-attempts">
          <Input id="assessment-attempts" type="number" {...form.register('maxAttempts')} />
        </Field>
        <Field label="Results" htmlFor="assessment-release">
          <select id="assessment-release" className="h-11 rounded-md border border-line px-3 text-sm" {...form.register('resultRelease')}>
            <option value="immediate">Show after submit when marking is finished</option>
            <option value="after_review">Hold until a staff member releases them</option>
          </select>
        </Field>
        <Field label="Instructions" htmlFor="assessment-instructions">
          <Textarea id="assessment-instructions" {...form.register('instructions')} />
        </Field>
        <div className="md:col-span-2">
          <Button type="submit">Create draft</Button>
        </div>
      </form>
      <DataTable data={assessments} columns={columns} caption="Assessments" />
    </div>
  )
}

export function AssessmentEditor() {
  const { assessmentId = '' } = useParams()
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const assessment = database.assessments.find((item) => item.id === assessmentId)
  usePageTitle(assessment?.title ?? 'Assessment')
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState<QuestionType>('multiple_choice')
  const [marks, setMarks] = useState(1)
  const [options, setOptions] = useState([
    { label: '', correct: true },
    { label: '', correct: false },
  ])
  const [accepted, setAccepted] = useState('')
  const [selectedAttempt, setSelectedAttempt] = useState<string>('')
  if (!user) return null
  if (!assessment || !canAccessCourse(database, user, assessment.courseId)) return <AccessDenied home="/staff" />
  const questions = database.questions.filter((question) => question.assessmentId === assessment.id).sort((a, b) => a.order - b.order)
  const attempts = database.assessmentAttempts.filter((attempt) => attempt.assessmentId === assessment.id)
  const activeAttempt = attempts.find((attempt) => attempt.id === selectedAttempt) ?? attempts[0]
  const objective = type === 'multiple_choice' || type === 'true_false' || type === 'multiple_answer'

  return (
    <div className="grid gap-6">
      <PageHeader
        title={assessment.title}
        description={`${courseById(database, assessment.courseId)?.name ?? ''} · ${assessmentTypeLabels[assessment.type]} · ${assessment.weight}% · ${assessment.status}`}
        actions={
          <>
            <Button variant="outline" onClick={() => changeStatus('draft')}>Draft</Button>
            <Button onClick={() => changeStatus('published')}>Publish</Button>
            <Button variant="outline" onClick={() => changeStatus('closed')}>Close</Button>
          </>
        }
      />
      <section className="grid gap-3">
        <h2 className="font-semibold text-navy">Questions</h2>
        {questions.map((question) => (
          <div key={question.id} className="rounded-lg border border-line bg-white p-4 text-sm">
            <Badge>{questionTypeLabels[question.type]}</Badge>
            <p className="mt-2 font-semibold">{question.prompt}</p>
            <p className="text-muted">{question.marks} marks</p>
          </div>
        ))}
        <form
          className="grid gap-3 rounded-lg border border-line bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault()
            try {
              addQuestion(user.id, {
                assessmentId: assessment.id,
                prompt,
                type,
                marks,
                options: type === 'true_false' ? [{ label: 'True', correct: accepted === 'true' }, { label: 'False', correct: accepted !== 'true' }] : options,
                acceptedAnswers: type === 'short_answer' ? [accepted] : [],
              })
              sync()
              setPrompt('')
              toast.success('Question added.')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'The question could not be added.')
            }
          }}
        >
          <h3 className="font-semibold text-navy">Add a question</h3>
          <Textarea aria-label="Question" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select aria-label="Question type" className="h-11 rounded-md border border-line px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as QuestionType)}>
              {(Object.keys(questionTypeLabels) as QuestionType[]).map((item) => <option key={item} value={item}>{questionTypeLabels[item]}</option>)}
            </select>
            <Input aria-label="Marks" type="number" value={marks} onChange={(event) => setMarks(Number(event.target.value))} />
          </div>
          {objective && type !== 'true_false' ? options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Checkbox checked={option.correct} onCheckedChange={(checked) => setOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, correct: checked === true } : item))} aria-label={`Option ${index + 1} is correct`} />
              <Input aria-label={`Option ${index + 1}`} value={option.label} onChange={(event) => setOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
            </div>
          )) : null}
          {objective && type !== 'true_false' ? <Button variant="outline" onClick={() => setOptions([...options, { label: '', correct: false }])}>Add option</Button> : null}
          {type === 'true_false' ? (
            <select aria-label="Correct answer" className="h-11 rounded-md border border-line px-3 text-sm" value={accepted || 'true'} onChange={(event) => setAccepted(event.target.value)}>
              <option value="true">True is correct</option>
              <option value="false">False is correct</option>
            </select>
          ) : null}
          {type === 'short_answer' ? <Input aria-label="Accepted answer" placeholder="Accepted answer" value={accepted} onChange={(event) => setAccepted(event.target.value)} /> : null}
          <Button type="submit">Add question</Button>
        </form>
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold text-navy">Submissions</h2>
        {attempts.length === 0 ? <p className="text-sm text-muted">No one has started this assessment.</p> : null}
        <div className="flex flex-wrap gap-2">
          {attempts.map((attempt) => {
            const student = userById(database, attempt.studentUserId)
            return (
              <Button key={attempt.id} variant={activeAttempt?.id === attempt.id ? 'primary' : 'outline'} onClick={() => setSelectedAttempt(attempt.id)}>
                {student ? fullName(student) : 'Student'} · {attemptStatusLabels[attempt.status]}
              </Button>
            )
          })}
        </div>
        {activeAttempt ? (
          <div className="grid gap-3 rounded-lg border border-line bg-white p-4">
            <p className="text-sm text-muted">Submitted {formatDateTime(activeAttempt.submittedAt)} · {activeAttempt.released ? `${activeAttempt.percentage}% released` : 'Not released'}</p>
            {questions.map((question) => {
              const answer = database.assessmentAnswers.find((item) => item.attemptId === activeAttempt.id && item.questionId === question.id)
              if (!answer) return null
              const manual = question.type === 'long_answer' || question.type === 'file_submission'
              const optionText = answer.optionIds
                .map((id) => database.questionOptions.find((option) => option.id === id)?.label ?? id)
                .join(', ')
              return (
                <MarkRow
                  key={answer.id}
                  prompt={question.prompt}
                  response={answer.text || answer.fileName || optionText || 'Blank'}
                  marks={question.marks}
                  awarded={answer.awardedMarks}
                  feedback={answer.feedback}
                  manual={manual && activeAttempt.status !== 'started'}
                  onSave={(score, feedback) => {
                    try {
                      saveManualMark(user.id, answer.id, score, feedback)
                      sync()
                      toast.success('Mark saved.')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'The mark could not be saved.')
                    }
                  }}
                />
              )
            })}
            {!activeAttempt.released && activeAttempt.status !== 'started' ? (
              <Button
                onClick={() => {
                  try {
                    releaseAttempt(user.id, activeAttempt.id)
                    sync()
                    toast.success('Result released.')
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'The result could not be released.')
                  }
                }}
              >
                Release result
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )

  function changeStatus(status: 'draft' | 'published' | 'closed') {
    try {
      setAssessmentStatus(user!.id, assessment!.id, status)
      sync()
      toast.success(`Assessment is now ${status}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The status could not be changed.')
    }
  }
}

function MarkRow({
  prompt,
  response,
  marks,
  awarded,
  feedback,
  manual,
  onSave,
}: {
  prompt: string
  response: string
  marks: number
  awarded: number | null
  feedback: string
  manual: boolean
  onSave: (score: number, feedback: string) => void
}) {
  const [score, setScore] = useState(awarded ?? 0)
  const [note, setNote] = useState(feedback)
  return (
    <div className="border-t border-line pt-3 text-sm">
      <p className="font-semibold text-navy">{prompt}</p>
      <p className="mt-1 text-muted">Response: {response}</p>
      {manual ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
          <Input aria-label={`Mark out of ${marks}`} type="number" min={0} max={marks} value={score} onChange={(event) => setScore(Number(event.target.value))} />
          <Input aria-label="Feedback" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Feedback" />
          <Button onClick={() => onSave(score, note)}>Save mark</Button>
        </div>
      ) : (
        <p className="mt-1">Automatic mark: {awarded ?? '—'}/{marks}</p>
      )}
    </div>
  )
}
