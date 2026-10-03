import type { QuestionType } from '../types/index.ts'

export interface MarkableQuestion {
  id: string
  type: QuestionType
  marks: number
  correctOptionIds: string[]
  acceptedAnswers: string[]
}

export interface GivenAnswer {
  questionId: string
  optionIds: string[]
  text: string
}

export interface QuestionMark {
  questionId: string
  awarded: number | null
  available: number
  autoMarked: boolean
}

export interface MarkSummary {
  awarded: number
  available: number
  percentage: number
  pendingManual: boolean
}

function normaliseText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function markQuestion(question: MarkableQuestion, answer: GivenAnswer | undefined): QuestionMark {
  const base = {
    questionId: question.id,
    available: question.marks,
  }

  if (question.type === 'long_answer' || question.type === 'file_submission') {
    return { ...base, awarded: null, autoMarked: false }
  }

  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const selected = answer?.optionIds ?? []
    const correct =
      selected.length === 1 && question.correctOptionIds.includes(selected[0] ?? '')
    return { ...base, awarded: correct ? question.marks : 0, autoMarked: true }
  }

  if (question.type === 'multiple_answer') {
    const selected = new Set(answer?.optionIds ?? [])
    const correct = new Set(question.correctOptionIds)
    const exact =
      selected.size === correct.size && [...correct].every((id) => selected.has(id))
    return { ...base, awarded: exact ? question.marks : 0, autoMarked: true }
  }

  const given = normaliseText(answer?.text ?? '')
  const matched = question.acceptedAnswers.some((accepted) => normaliseText(accepted) === given)
  return { ...base, awarded: matched && given.length > 0 ? question.marks : 0, autoMarked: true }
}

export function summariseMarks(items: QuestionMark[]): MarkSummary {
  const available = items.reduce((sum, item) => sum + item.available, 0)
  const awarded = items.reduce((sum, item) => sum + (item.awarded ?? 0), 0)
  const percentage = available === 0 ? 0 : Math.round((awarded / available) * 100)
  return {
    awarded,
    available,
    percentage,
    pendingManual: items.some((item) => item.awarded === null),
  }
}
