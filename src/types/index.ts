export type Role = 'super_admin' | 'administrator' | 'facilitator' | 'student'

export type AccountStatus = 'active' | 'inactive'

export type CourseStatus = 'draft' | 'active' | 'archived'

export type EnrolmentStatus = 'active' | 'suspended' | 'withdrawn' | 'completed'

export type MaterialCategory =
  | 'learner_guide'
  | 'notes'
  | 'previous_paper'
  | 'memorandum'
  | 'assignment'
  | 'practical'
  | 'presentation'
  | 'reference'

export type MaterialStatus = 'published' | 'archived'

export type AssessmentType = 'quiz' | 'assignment' | 'test' | 'final'

export type AssessmentStatus = 'draft' | 'published' | 'closed'

export type ResultRelease = 'immediate' | 'after_review'

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'multiple_answer'
  | 'short_answer'
  | 'long_answer'
  | 'file_submission'

export type AttemptStatus = 'started' | 'submitted' | 'marked' | 'reviewed'

export type CourseResultStatus = 'in_progress' | 'pass' | 'fail'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type CertificateStatus = 'valid' | 'revoked'

export interface User {
  id: string
  email: string
  role: Role
  status: AccountStatus
  firstName: string
  lastName: string
  phone: string
  createdAt: string
}

export interface RoleDefinition {
  id: Role
  name: string
  summary: string
  permissions: string[]
}

export interface StudentProfile {
  id: string
  userId: string
  studentNumber: string
}

export interface StaffProfile {
  id: string
  userId: string
  staffNumber: string
  title: string
}

export interface Course {
  id: string
  name: string
  code: string
  description: string
  duration: string
  level: string
  status: CourseStatus
  startDate: string
  endDate: string
  passMark: number
  certificatePattern: string
}

export interface CourseModule {
  id: string
  courseId: string
  title: string
  order: number
}

export interface CourseStaff {
  id: string
  courseId: string
  staffUserId: string
}

export interface Enrolment {
  id: string
  studentUserId: string
  courseId: string
  status: EnrolmentStatus
  enrolledAt: string
}

export interface Material {
  id: string
  courseId: string
  moduleId: string | null
  title: string
  description: string
  category: MaterialCategory
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  status: MaterialStatus
  visibilityDate: string | null
}

export interface MaterialVersion {
  id: string
  materialId: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
  note: string
}

export interface Assessment {
  id: string
  courseId: string
  title: string
  type: AssessmentType
  instructions: string
  weight: number
  timeLimitMinutes: number | null
  maxAttempts: number
  resultRelease: ResultRelease
  status: AssessmentStatus
  availableFrom: string
  availableUntil: string
}

export interface Question {
  id: string
  assessmentId: string
  prompt: string
  type: QuestionType
  marks: number
  order: number
  acceptedAnswers: string[]
}

export interface QuestionOption {
  id: string
  questionId: string
  label: string
  isCorrect: boolean
}

export interface AssessmentAttempt {
  id: string
  assessmentId: string
  studentUserId: string
  status: AttemptStatus
  startedAt: string
  submittedAt: string | null
  score: number | null
  maxScore: number | null
  percentage: number | null
  released: boolean
}

export interface AssessmentAnswer {
  id: string
  attemptId: string
  questionId: string
  optionIds: string[]
  text: string
  fileName: string | null
  awardedMarks: number | null
  feedback: string
  autoMarked: boolean
}

export interface CourseResult {
  id: string
  enrolmentId: string
  percentage: number | null
  status: CourseResultStatus
  calculatedAt: string
}

export interface AttendanceSession {
  id: string
  courseId: string
  title: string
  date: string
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentUserId: string
  status: AttendanceStatus
}

export interface CertificateTemplate {
  id: string
  courseId: string
  name: string
  signatory: string
  signatoryTitle: string
}

export interface Certificate {
  id: string
  templateId: string
  studentUserId: string
  courseId: string
  certificateNumber: string
  studentName: string
  courseName: string
  courseCode: string
  completionDate: string
  result: string
  status: CertificateStatus
  issuedAt: string
}

export interface Announcement {
  id: string
  courseId: string | null
  title: string
  body: string
  publishedAt: string
  authorUserId: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export type TicketCategory = 'access' | 'assessment' | 'certificate' | 'technical' | 'other'
export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export interface ChatThread {
  id: string
  courseId: string | null
  subject: string
  participantIds: string[]
}

export interface ChatMessage {
  id: string
  threadId: string
  senderUserId: string
  body: string
  createdAt: string
}

export interface EmailRecord {
  id: string
  fromUserId: string
  toUserId: string
  subject: string
  body: string
  createdAt: string
  status: 'recorded'
}

export interface Ticket {
  id: string
  reporterUserId: string
  courseId: string | null
  subject: string
  body: string
  category: TicketCategory
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

export interface TicketReply {
  id: string
  ticketId: string
  authorUserId: string
  body: string
  createdAt: string
}

export interface AuditLog {
  id: string
  actorUserId: string
  action: string
  entity: string
  entityId: string
  timestamp: string
  previousValue: string | null
  newValue: string | null
}

export interface Settings {
  seedVersion: number
  certificateYear: number
  maxUploadMb: number
}

export interface Database {
  users: User[]
  roles: RoleDefinition[]
  studentProfiles: StudentProfile[]
  staffProfiles: StaffProfile[]
  courses: Course[]
  courseModules: CourseModule[]
  courseStaff: CourseStaff[]
  enrolments: Enrolment[]
  materials: Material[]
  materialVersions: MaterialVersion[]
  assessments: Assessment[]
  questions: Question[]
  questionOptions: QuestionOption[]
  assessmentAttempts: AssessmentAttempt[]
  assessmentAnswers: AssessmentAnswer[]
  courseResults: CourseResult[]
  attendanceSessions: AttendanceSession[]
  attendanceRecords: AttendanceRecord[]
  certificateTemplates: CertificateTemplate[]
  certificates: Certificate[]
  announcements: Announcement[]
  notifications: Notification[]
  chatThreads: ChatThread[]
  chatMessages: ChatMessage[]
  emails: EmailRecord[]
  tickets: Ticket[]
  ticketReplies: TicketReply[]
  auditLogs: AuditLog[]
  settings: Settings
}

export interface StudentQuestion {
  id: string
  prompt: string
  type: QuestionType
  marks: number
  order: number
  options: { id: string; label: string }[]
}
