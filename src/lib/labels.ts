import type {
  AssessmentType,
  AttemptStatus,
  EnrolmentStatus,
  MaterialCategory,
  QuestionType,
  Role,
} from '../types/index.ts'

export const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  administrator: 'Administrator',
  facilitator: 'Facilitator',
  student: 'Student',
}

export const materialCategoryLabels: Record<MaterialCategory, string> = {
  learner_guide: 'Learner guide',
  notes: 'Notes',
  previous_paper: 'Previous paper',
  memorandum: 'Memorandum',
  assignment: 'Assignment',
  practical: 'Practical',
  presentation: 'Presentation',
  reference: 'Reference',
}

export const assessmentTypeLabels: Record<AssessmentType, string> = {
  quiz: 'Quiz',
  assignment: 'Assignment',
  test: 'Test',
  final: 'Final assessment',
}

export const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / false',
  multiple_answer: 'Multiple answer',
  short_answer: 'Short answer',
  long_answer: 'Open response',
  file_submission: 'File submission',
}

export const enrolmentStatusLabels: Record<EnrolmentStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
}

export const attemptStatusLabels: Record<AttemptStatus, string> = {
  started: 'In progress',
  submitted: 'Submitted',
  marked: 'Marked',
  reviewed: 'Reviewed',
}
