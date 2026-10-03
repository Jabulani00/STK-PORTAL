import { attendanceSummary } from '../lib/attendance.ts'
import { fullName, localIsoDate } from '../lib/format.ts'
import type {
  Assessment,
  AttendanceRecord,
  Database,
  Material,
  Role,
  StudentQuestion,
  User,
} from '../types/index.ts'

export class AccessError extends Error {
  constructor(message = 'You do not have access to this record.') {
    super(message)
    this.name = 'AccessError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const DEMO_PASSWORD = 'stk-demo'

const LEARNING_ENROLMENTS = new Set(['active', 'completed'])

export function isStaffRole(role: Role) {
  return role === 'super_admin' || role === 'administrator' || role === 'facilitator'
}

export function canManageUsers(role: Role) {
  return role === 'super_admin'
}

export function canManageSettings(role: Role) {
  return role === 'super_admin' || role === 'administrator'
}

export function canManageCourses(role: Role) {
  return role === 'super_admin' || role === 'administrator'
}

export function canPostSystemAnnouncement(role: Role) {
  return role === 'super_admin' || role === 'administrator'
}

export function canViewAudit(role: Role) {
  return role === 'super_admin'
}

export function canChangeAccountStatus(role: Role) {
  return role === 'super_admin' || role === 'administrator'
}

export function userById(db: Database, userId: string) {
  return db.users.find((user) => user.id === userId) ?? null
}

export function courseById(db: Database, courseId: string) {
  return db.courses.find((course) => course.id === courseId) ?? null
}

export function studentNumberOf(db: Database, userId: string) {
  return db.studentProfiles.find((profile) => profile.userId === userId)?.studentNumber ?? ''
}

export function assignedCourseIds(db: Database, userId: string) {
  return db.courseStaff.filter((row) => row.staffUserId === userId).map((row) => row.courseId)
}

export function studentCanAccessCourse(db: Database, userId: string, courseId: string) {
  return db.enrolments.some(
    (enrolment) =>
      enrolment.studentUserId === userId &&
      enrolment.courseId === courseId &&
      LEARNING_ENROLMENTS.has(enrolment.status),
  )
}

export function canAccessCourse(db: Database, user: User, courseId: string) {
  if (user.status !== 'active') return false
  if (user.role === 'student') return studentCanAccessCourse(db, user.id, courseId)
  if (user.role === 'facilitator') return assignedCourseIds(db, user.id).includes(courseId)
  return isStaffRole(user.role)
}

export function canSeeStudent(db: Database, actor: User, studentUserId: string) {
  if (actor.role === 'student') return actor.id === studentUserId
  if (actor.role === 'facilitator') {
    const courses = new Set(assignedCourseIds(db, actor.id))
    return db.enrolments.some(
      (enrolment) => enrolment.studentUserId === studentUserId && courses.has(enrolment.courseId),
    )
  }
  return isStaffRole(actor.role)
}

export function visibleCourses(db: Database, user: User) {
  return db.courses
    .filter((course) => {
      if (user.role === 'student') {
        return course.status !== 'archived' && studentCanAccessCourse(db, user.id, course.id)
      }
      if (user.role === 'facilitator') return assignedCourseIds(db, user.id).includes(course.id)
      return isStaffRole(user.role)
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function visibleStudents(db: Database, user: User) {
  return db.users
    .filter((person) => person.role === 'student' && canSeeStudent(db, user, person.id))
    .sort((left, right) => left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName))
}

export function materialVisibleToStudent(db: Database, userId: string, material: Material, today: string) {
  if (material.status !== 'published') return false
  if (!studentCanAccessCourse(db, userId, material.courseId)) return false
  if (material.visibilityDate && material.visibilityDate > today) return false
  return true
}

export function visibleMaterials(db: Database, user: User, courseId?: string, today?: string) {
  return db.materials.filter((material) => {
    if (courseId && material.courseId !== courseId) return false
    if (user.role === 'student') return materialVisibleToStudent(db, user.id, material, today ?? localIsoDate())
    return canAccessCourse(db, user, material.courseId)
  })
}

export function visibleAssessments(db: Database, user: User, courseId?: string) {
  return db.assessments
    .filter((assessment) => {
      if (courseId && assessment.courseId !== courseId) return false
      if (!canAccessCourse(db, user, assessment.courseId)) return false
      if (user.role === 'student') return assessment.status === 'published'
      return true
    })
    .sort((left, right) => left.title.localeCompare(right.title))
}

export function visibleCertificates(db: Database, user: User) {
  return db.certificates.filter((certificate) => {
    if (user.role === 'student') return certificate.studentUserId === user.id
    return canAccessCourse(db, user, certificate.courseId)
  })
}

export function visibleAnnouncements(db: Database, user: User) {
  const courseIds = new Set(visibleCourses(db, user).map((course) => course.id))
  return db.announcements
    .filter((announcement) => announcement.courseId === null || courseIds.has(announcement.courseId))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
}

export function visibleAttempts(db: Database, user: User) {
  return db.assessmentAttempts.filter((attempt) => {
    if (user.role === 'student') return attempt.studentUserId === user.id
    const assessment = db.assessments.find((item) => item.id === attempt.assessmentId)
    return assessment ? canAccessCourse(db, user, assessment.courseId) : false
  })
}

export function studentQuestions(db: Database, assessmentId: string): StudentQuestion[] {
  return db.questions
    .filter((question) => question.assessmentId === assessmentId)
    .sort((left, right) => left.order - right.order)
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      marks: question.marks,
      order: question.order,
      options: db.questionOptions
        .filter((option) => option.questionId === question.id)
        .map((option) => ({ id: option.id, label: option.label })),
    }))
}

export function courseProgress(db: Database, userId: string, courseId: string) {
  const assessments = db.assessments.filter(
    (assessment) => assessment.courseId === courseId && assessment.status === 'published',
  )
  if (assessments.length === 0) return 0
  const completed = assessments.filter((assessment) =>
    db.assessmentAttempts.some(
      (attempt) =>
        attempt.assessmentId === assessment.id &&
        attempt.studentUserId === userId &&
        attempt.released,
    ),
  ).length
  return Math.round((completed / assessments.length) * 100)
}

export function attendanceForStudent(db: Database, userId: string, courseId?: string) {
  const sessions = db.attendanceSessions.filter((session) => !courseId || session.courseId === courseId)
  const sessionIds = new Set(sessions.map((session) => session.id))
  const records = db.attendanceRecords.filter(
    (record) => record.studentUserId === userId && sessionIds.has(record.sessionId),
  )
  return { sessions, records, summary: attendanceSummary(records) }
}

export function facilitatorNames(db: Database, courseId: string) {
  return db.courseStaff
    .filter((row) => row.courseId === courseId)
    .map((row) => userById(db, row.staffUserId))
    .filter((user): user is User => user !== null)
    .map((user) => fullName(user))
}

export function certificateEligibility(db: Database, studentUserId: string, courseId: string) {
  const enrolment = db.enrolments.find(
    (item) => item.studentUserId === studentUserId && item.courseId === courseId,
  )
  if (!enrolment || enrolment.status === 'withdrawn' || enrolment.status === 'suspended') {
    return { ok: false, reason: 'The student does not have an active enrolment.' }
  }
  const existing = db.certificates.find(
    (certificate) =>
      certificate.studentUserId === studentUserId &&
      certificate.courseId === courseId &&
      certificate.status === 'valid',
  )
  if (existing) return { ok: false, reason: 'A valid certificate is already on file.' }
  const result = db.courseResults.find((item) => item.enrolmentId === enrolment.id)
  if (!result || result.status !== 'pass') {
    return { ok: false, reason: 'The course result is not a pass yet.' }
  }
  return { ok: true, reason: 'Ready to issue.' }
}

export function findPublicCertificate(db: Database, certificateNumber: string) {
  const certificate = db.certificates.find(
    (item) => item.certificateNumber.toLowerCase() === certificateNumber.trim().toLowerCase(),
  )
  if (!certificate) return null
  return {
    certificateNumber: certificate.certificateNumber,
    studentName: certificate.studentName,
    courseName: certificate.courseName,
    completionDate: certificate.completionDate,
    status: certificate.status,
  }
}

export function attemptsForAssessment(db: Database, assessment: Assessment, studentUserId: string) {
  return db.assessmentAttempts
    .filter((attempt) => attempt.assessmentId === assessment.id && attempt.studentUserId === studentUserId)
    .sort((left, right) => (right.startedAt).localeCompare(left.startedAt))
}

export function recordsForSession(db: Database, sessionId: string): AttendanceRecord[] {
  return db.attendanceRecords.filter((record) => record.sessionId === sessionId)
}

export function visibleThreads(db: Database, user: User) {
  return db.chatThreads.filter((thread) => {
    if (thread.participantIds.includes(user.id)) return true
    if (user.role === 'student') return false
    if (!thread.courseId) return isStaffRole(user.role) && user.role !== 'facilitator'
    return canAccessCourse(db, user, thread.courseId)
  })
}

export function visibleEmails(db: Database, user: User) {
  if (user.role === 'student') return db.emails.filter((email) => email.toUserId === user.id)
  return db.emails.filter((email) => email.fromUserId === user.id || canSeeStudent(db, user, email.toUserId))
}

export function visibleTickets(db: Database, user: User) {
  if (user.role === 'student') return db.tickets.filter((ticket) => ticket.reporterUserId === user.id)
  return db.tickets.filter((ticket) => canSeeStudent(db, user, ticket.reporterUserId))
}
