import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AccessDenied } from '../../components/access-denied.tsx'
import { Callout } from '../../components/callout.tsx'
import { ConfirmDialog } from '../../components/confirm-dialog.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Checkbox } from '../../components/ui/checkbox.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { assessmentWindow } from '../../lib/assessment-window.ts'
import { formatDateTime } from '../../lib/format.ts'
import { validateUpload } from '../../lib/files.ts'
import { questionTypeLabels } from '../../lib/labels.ts'
import { canAccessCourse, courseById, studentQuestions } from '../../services/access.ts'
import { presentAnswer, releasedAnswerKey, saveDraft, startAttempt, submitAttempt, type DraftAnswerInput } from '../../services/api.ts'
import type { StudentQuestion } from '../../types/index.ts'

export function TakeAssessment() {
  const { assessmentId = '' } = useParams()
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const assessment = database.assessments.find((item) => item.id === assessmentId)
  const course = assessment ? courseById(database, assessment.courseId) : null
  usePageTitle(assessment?.title ?? 'Assessment')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const submitting = useRef(false)
  const questions = assessment ? studentQuestions(database, assessment.id) : []
  const attempts = assessment && user
    ? database.assessmentAttempts
        .filter((attempt) => attempt.assessmentId === assessment.id && attempt.studentUserId === user.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    : []
  const started = attempts.find((attempt) => attempt.status === 'started')
  const [drafts, setDrafts] = useState<DraftAnswerInput[]>([])

  useEffect(() => {
    if (!started) return
    setDrafts(
      questions.map((question) => {
        const answer = database.assessmentAnswers.find(
          (item) => item.attemptId === started.id && item.questionId === question.id,
        )
        return {
          questionId: question.id,
          optionIds: answer?.optionIds ?? [],
          text: answer?.text ?? '',
          fileName: answer?.fileName ?? null,
        }
      }),
    )
  }, [started?.id])

  useEffect(() => {
    if (!started || !assessment?.timeLimitMinutes) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [started?.id, assessment?.timeLimitMinutes])

  useEffect(() => {
    if (!user || !started || !assessment?.timeLimitMinutes || submitting.current) return
    const remainingSeconds =
      assessment.timeLimitMinutes * 60 - Math.floor((now - new Date(started.startedAt).getTime()) / 1000)
    if (remainingSeconds > 0) return
    submitting.current = true
    try {
      submitAttempt(user.id, started.id)
      sync()
      toast.success('Time is up. Your assessment was submitted.')
    } catch (error) {
      submitting.current = false
      toast.error(error instanceof Error ? error.message : 'The assessment could not be submitted.')
    }
  }, [now, started?.id, assessment?.timeLimitMinutes, user, sync])

  if (!user) return null
  if (!assessment || !course || user.role !== 'student' || !canAccessCourse(database, user, course.id) || assessment.status !== 'published') {
    return <AccessDenied home="/app" />
  }

  const windowState = assessmentWindow(assessment)
  const remaining = assessment.timeLimitMinutes && started
    ? assessment.timeLimitMinutes * 60 - Math.floor((now - new Date(started.startedAt).getTime()) / 1000)
    : null
  const latestFinished = attempts.find((attempt) => attempt.status !== 'started')
  const pendingReview = attempts.some((attempt) => attempt.status === 'submitted')
  const attemptsLeft = assessment.maxAttempts - attempts.filter((attempt) => attempt.status !== 'started').length

  function persist(next: DraftAnswerInput[]) {
    if (!started || !user) return
    setDrafts(next)
    saveDraft(user.id, started.id, next)
    sync()
  }

  function updateDraft(questionId: string, patch: Partial<DraftAnswerInput>) {
    persist(drafts.map((draft) => (draft.questionId === questionId ? { ...draft, ...patch } : draft)))
  }

  function finish() {
    if (!started || !user || submitting.current) return
    submitting.current = true
    try {
      saveDraft(user.id, started.id, drafts)
      submitAttempt(user.id, started.id)
      sync()
      setConfirmOpen(false)
      toast.success('Assessment submitted.')
    } catch (error) {
      submitting.current = false
      toast.error(error instanceof Error ? error.message : 'The assessment could not be submitted.')
    }
  }

  const unanswered = drafts.filter((draft) => {
    const question = questions.find((item) => item.id === draft.questionId)
    if (!question) return false
    if (question.type === 'short_answer' || question.type === 'long_answer') return draft.text.trim().length === 0
    if (question.type === 'file_submission') return !draft.fileName
    return draft.optionIds.length === 0
  }).length

  return (
    <div>
      <PageHeader title={assessment.title} description={`${course.name}. ${assessment.instructions}`} />
      <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted">
        <span>{assessment.maxAttempts} attempt{assessment.maxAttempts === 1 ? '' : 's'}</span>
        <span>{assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minute limit` : 'No time limit'}</span>
        <span>{assessment.resultRelease === 'immediate' ? 'Objective results show after you submit' : 'Results are released after review'}</span>
      </div>
      {windowState === 'upcoming' ? <Callout>This assessment opens on {assessment.availableFrom}.</Callout> : null}
      {windowState === 'closed' && !latestFinished ? <Callout tone="warning">This assessment has closed.</Callout> : null}
      {!started && windowState === 'open' ? (
        <div className="grid gap-3">
          {pendingReview ? <Callout>Your last attempt is still being marked.</Callout> : null}
          <Button
            disabled={pendingReview || attemptsLeft <= 0}
            onClick={() => {
              try {
                startAttempt(user.id, assessment.id)
                submitting.current = false
                sync()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'The assessment could not be started.')
              }
            }}
          >
            {attempts.some((attempt) => attempt.status !== 'started') ? 'Start another attempt' : 'Start assessment'}
          </Button>
          <p className="text-sm text-muted">{Math.max(attemptsLeft, 0)} attempt{attemptsLeft === 1 ? '' : 's'} remaining. Your latest submitted attempt counts.</p>
        </div>
      ) : null}
      {started ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setConfirmOpen(true)
          }}
        >
          {remaining !== null ? (
            <p className="text-sm font-semibold text-navy" aria-live="polite">
              Time remaining: {Math.max(0, Math.floor(remaining / 60))}:{String(Math.max(0, remaining % 60)).padStart(2, '0')}
            </p>
          ) : null}
          <p className="text-sm text-muted">
            {questions.length - unanswered} of {questions.length} answered
          </p>
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              question={question}
              draft={drafts.find((item) => item.questionId === question.id)}
              maxMb={database.settings.maxUploadMb}
              onChange={(patch) => updateDraft(question.id, patch)}
            />
          ))}
          <Button type="submit">Submit assessment</Button>
        </form>
      ) : null}
      {latestFinished ? <AttemptReview attemptId={latestFinished.id} /> : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this attempt?"
        description={
          unanswered > 0
            ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still blank. You can still submit.`
            : 'You will not be able to change these answers.'
        }
        confirmLabel="Submit"
        onConfirm={finish}
      />
    </div>
  )
}

function QuestionCard({
  question,
  index,
  draft,
  maxMb,
  onChange,
}: {
  question: StudentQuestion
  index: number
  draft: DraftAnswerInput | undefined
  maxMb: number
  onChange: (patch: Partial<DraftAnswerInput>) => void
}) {
  const selected = draft?.optionIds ?? []
  return (
    <fieldset className="rounded-lg border border-line bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-navy">
        {index + 1}. {question.prompt}
      </legend>
      <p className="mb-3 text-xs text-muted">{questionTypeLabels[question.type]} · {question.marks} mark{question.marks === 1 ? '' : 's'}</p>
      {question.type === 'multiple_choice' || question.type === 'true_false'
        ? question.options.map((option) => (
            <label key={option.id} className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={question.id}
                checked={selected.includes(option.id)}
                onChange={() => onChange({ optionIds: [option.id] })}
              />
              {option.label}
            </label>
          ))
        : null}
      {question.type === 'multiple_answer'
        ? question.options.map((option) => (
            <label key={option.id} className="mb-2 flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(option.id)}
                onCheckedChange={(checked) => {
                  const next = checked === true ? [...selected, option.id] : selected.filter((id) => id !== option.id)
                  onChange({ optionIds: next })
                }}
                aria-label={option.label}
              />
              {option.label}
            </label>
          ))
        : null}
      {question.type === 'short_answer' ? (
        <Input aria-label="Short answer" value={draft?.text ?? ''} onChange={(event) => onChange({ text: event.target.value })} />
      ) : null}
      {question.type === 'long_answer' ? (
        <Textarea aria-label="Open response" value={draft?.text ?? ''} onChange={(event) => onChange({ text: event.target.value })} />
      ) : null}
      {question.type === 'file_submission' ? (
        <div className="grid gap-2">
          <input
            aria-label="Submission file"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const error = validateUpload({ name: file.name, type: file.type, size: file.size }, maxMb)
              if (error) {
                toast.error(error)
                event.target.value = ''
                return
              }
              onChange({ fileName: file.name })
            }}
          />
          {draft?.fileName ? <p className="text-sm text-muted">Selected: {draft.fileName}. The file itself is not stored in this prototype.</p> : null}
        </div>
      ) : null}
    </fieldset>
  )
}

function AttemptReview({ attemptId }: { attemptId: string }) {
  const database = useDatabase()
  const attempt = database.assessmentAttempts.find((item) => item.id === attemptId)
  const assessment = attempt ? database.assessments.find((item) => item.id === attempt.assessmentId) : null
  if (!attempt || !assessment) return null
  const questions = studentQuestions(database, assessment.id)
  return (
    <section className="mt-8 grid gap-3">
      <h2 className="text-lg font-semibold text-navy">Latest attempt</h2>
      <p className="text-sm text-muted">Submitted {formatDateTime(attempt.submittedAt)}</p>
      {attempt.released ? (
        <Callout tone="success">Result: {attempt.percentage}% ({attempt.score}/{attempt.maxScore})</Callout>
      ) : (
        <Callout tone="warning">Submitted. The result is waiting for review.</Callout>
      )}
      {questions.map((question) => {
        const stored = database.assessmentAnswers.find((item) => item.attemptId === attempt.id && item.questionId === question.id)
        if (!stored) return null
        const answer = presentAnswer(stored, attempt, assessment)
        const key = releasedAnswerKey(attempt, question.id)
        return (
          <div key={question.id} className="rounded-lg border border-line bg-white p-4 text-sm">
            <p className="font-semibold text-navy">{question.prompt}</p>
            <p className="mt-1 text-muted">
              Your response:{' '}
              {answer.optionIds.map((id) => question.options.find((option) => option.id === id)?.label).filter(Boolean).join(', ') ||
                answer.text ||
                answer.fileName ||
                'Blank'}
            </p>
            {answer.awardedMarks !== null ? <p className="mt-1">Awarded {answer.awardedMarks} / {question.marks}</p> : null}
            {key ? <p className="mt-1">Accepted answer: {key.join(', ')}</p> : null}
            {answer.feedback ? <p className="mt-1">Feedback: {answer.feedback}</p> : null}
          </div>
        )
      })}
    </section>
  )
}
