import { describe, expect, it } from 'vitest'
import { nextCertificateNumber } from './certificate-number.ts'
import { validateStudentImport, validateTicketImport } from './csv.ts'
import { sanitiseFileName, validateUpload } from './files.ts'
import { markQuestion, summariseMarks, type MarkableQuestion } from './marking.ts'
import { calculateCourseScore } from './results.ts'

const pattern = 'STK-{CODE}-{YEAR}-{SEQ}'

function question(overrides: Partial<MarkableQuestion> & Pick<MarkableQuestion, 'id' | 'type'>): MarkableQuestion {
  return {
    marks: 1,
    correctOptionIds: [],
    acceptedAnswers: [],
    ...overrides,
  }
}

describe('marking', () => {
  it('scores a mixed paper as awarded marks over available marks', () => {
    const questions = [
      question({ id: 'q1', type: 'multiple_choice', correctOptionIds: ['a'] }),
      question({ id: 'q2', type: 'true_false', correctOptionIds: ['false'] }),
      question({ id: 'q3', type: 'multiple_answer', marks: 2, correctOptionIds: ['list', 'dict'] }),
      question({ id: 'q4', type: 'short_answer', acceptedAnswers: ['def'] }),
      question({ id: 'q5', type: 'long_answer', marks: 5 }),
    ]
    const answers = [
      { questionId: 'q1', optionIds: ['a'], text: '' },
      { questionId: 'q2', optionIds: ['false'], text: '' },
      { questionId: 'q3', optionIds: ['list'], text: '' },
      { questionId: 'q4', optionIds: [], text: ' Def ' },
      { questionId: 'q5', optionIds: [], text: 'It sends a value back.' },
    ]
    const marks = questions.map((item) => markQuestion(item, answers.find((answer) => answer.questionId === item.id)))
    const summary = summariseMarks(marks)

    expect(marks.map((item) => item.awarded)).toEqual([1, 1, 0, 1, null])
    expect(summary).toEqual({ awarded: 3, available: 10, percentage: 30, pendingManual: true })
  })

  it('awards multiple-answer marks only when the selection matches exactly', () => {
    const item = question({
      id: 'multi',
      type: 'multiple_answer',
      marks: 2,
      correctOptionIds: ['list', 'dict'],
    })
    expect(markQuestion(item, { questionId: 'multi', optionIds: ['dict', 'list'], text: '' }).awarded).toBe(2)
    expect(markQuestion(item, { questionId: 'multi', optionIds: ['list', 'dict', 'slide'], text: '' }).awarded).toBe(0)
  })
})

describe('weighted results', () => {
  it('calculates a 20/20/30/30 course result and a pass mark', () => {
    const score = calculateCourseScore(
      [
        { assessmentId: 'quiz', weight: 20, percentage: 80 },
        { assessmentId: 'assignment', weight: 20, percentage: 70 },
        { assessmentId: 'test', weight: 30, percentage: 60 },
        { assessmentId: 'final', weight: 30, percentage: 90 },
      ],
      50,
    )
    expect(score).toEqual({ percentage: 75, complete: true, status: 'pass' })
  })

  it('keeps an unfinished course in progress and fails a finished course under the pass mark', () => {
    expect(
      calculateCourseScore(
        [
          { assessmentId: 'quiz', weight: 40, percentage: 80 },
          { assessmentId: 'practical', weight: 60, percentage: null },
        ],
        50,
      ).status,
    ).toBe('in_progress')

    expect(
      calculateCourseScore(
        [
          { assessmentId: 'quiz', weight: 40, percentage: 80 },
          { assessmentId: 'practical', weight: 60, percentage: 82 },
        ],
        50,
      ),
    ).toEqual({ percentage: 81, complete: true, status: 'pass' })

    expect(
      calculateCourseScore([{ assessmentId: 'final', weight: 100, percentage: 49 }], 50).status,
    ).toBe('fail')
  })
})

describe('certificate numbers', () => {
  it('issues the next padded number without colliding across course or year', () => {
    const first = nextCertificateNumber(pattern, 'py', 2026, [])
    const second = nextCertificateNumber(pattern, 'PY', 2026, [first, 'STK-PY-2026-000004'])
    const web = nextCertificateNumber(pattern, 'WEB', 2026, [first, second])
    const nextYear = nextCertificateNumber(pattern, 'PY', 2027, [first, second])

    expect(first).toBe('STK-PY-2026-000001')
    expect(second).toBe('STK-PY-2026-000005')
    expect(web).toBe('STK-WEB-2026-000001')
    expect(nextYear).toBe('STK-PY-2027-000001')
  })
})

describe('import and file validation', () => {
  const context = {
    studentNumbers: ['STK2026001'],
    emails: ['lerato.khumalo@stkcollege.org'],
    courses: [{ id: 'c-py', code: 'PY', name: 'Python Programming' }],
  }

  it('accepts a valid student row and reports duplicates and field errors', () => {
    const csv = [
      'Student Number,First Name,Last Name,Email,Phone,Course,Enrolment Date',
      'STK2026999,Amina,Yusuf,amina.yusuf@stkcollege.org,0820000000,PY,2026-03-01',
      'STK2026001,Lerato,Khumalo,lerato.khumalo@stkcollege.org,0820000001,PY,2026-03-01',
      'STK2026888,Sam,Lee,not-an-email,12,UNKNOWN,03/01/2026',
      'STK2026999,Amina,Yusuf,amina.yusuf@stkcollege.org,0820000002,Python Programming,2026-03-02',
    ].join('\n')

    const preview = validateStudentImport(csv, context)
    expect(preview.headerError).toBeNull()
    expect(preview.rows[0]?.errors).toEqual([])
    expect(preview.rows[0]?.courseId).toBe('c-py')
    expect(preview.rows[1]?.errors.join(' ')).toContain('student number already exists')
    expect(preview.rows[1]?.errors.join(' ')).toContain('email already exists')
    expect(preview.rows[2]?.errors.length).toBeGreaterThanOrEqual(3)
    expect(preview.rows[3]?.errors.join(' ')).toContain('duplicates row 2')
  })

  it('rejects a file whose header does not match the template', () => {
    const preview = validateStudentImport('Name,Email\nAmina,amina@stkcollege.org', context)
    expect(preview.headerError).toContain('Student Number')
    expect(preview.rows).toEqual([])
  })

  it('sanitises file names and rejects dangerous or mismatched uploads', () => {
    expect(sanitiseFileName('../../secret.pdf')).toBe('secret.pdf')
    expect(sanitiseFileName('notes (week 1).pdf')).toBe('notes_week_1_.pdf')
    expect(validateUpload({ name: 'guide.pdf', type: 'application/pdf', size: 1200 }, 20)).toBeNull()
    expect(validateUpload({ name: 'virus.exe', type: 'application/octet-stream', size: 1200 }, 20)).toContain(
      'not allowed',
    )
    expect(validateUpload({ name: 'guide.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 }, 20)).toContain(
      'larger',
    )
  })
})

describe('ticket import', () => {
  const context = {
    students: [{ userId: 'u-lerato', studentNumber: 'STK2026001', name: 'Lerato Khumalo' }],
    courses: [{ id: 'c-py', code: 'PY', name: 'Python Programming' }],
  }

  it('accepts a matching student and rejects a bad category', () => {
    const preview = validateTicketImport(
      'Student Number,Subject,Category,Course,Details\nSTK2026001,Timer,assessment,PY,The timer kept running\nSTK2026001,Broken,billing,,Missing category\n',
      context,
    )
    expect(preview.headerError).toBeNull()
    expect(preview.rows[0]?.errors).toEqual([])
    expect(preview.rows[0]?.courseId).toBe('c-py')
    expect(preview.rows[1]?.errors.join(' ')).toContain('Category')
  })
})
