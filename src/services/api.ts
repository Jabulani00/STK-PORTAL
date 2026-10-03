import { assessmentWindow } from '../lib/assessment-window.ts'
import { nextCertificateNumber } from '../lib/certificate-number.ts'
import type { CertificateImportRow, StudentImportRow, TicketImportRow } from '../lib/csv.ts'
import { fullName } from '../lib/format.ts'
import { sanitiseFileName, validateUpload, type UploadMeta } from '../lib/files.ts'
import { createId } from '../lib/id.ts'
import { markQuestion, summariseMarks, type GivenAnswer } from '../lib/marking.ts'
import { calculateCourseScore } from '../lib/results.ts'
import type {
  Announcement,
  Assessment,
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentStatus,
  AssessmentType,
  AttendanceStatus,
  CourseStatus,
  Database,
  EnrolmentStatus,
  MaterialCategory,
  Question,
  QuestionType,
  ResultRelease,
  Role,
  TicketCategory,
  TicketStatus,
  User,
} from '../types/index.ts'
import {
  AccessError,
  DEMO_PASSWORD,
  ValidationError,
  canAccessCourse,
  canChangeAccountStatus,
  canManageCourses,
  canManageSettings,
  canManageUsers,
  canPostSystemAnnouncement,
  canSeeStudent,
  courseById,
  isStaffRole,
  studentCanAccessCourse,
  studentNumberOf,
  userById,
  visibleThreads,
  visibleTickets,
} from './access.ts'
import { portalStore } from './store.ts'

export interface CreateStudentInput {
  studentNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
  courseId: string | null
  enrolmentDate: string | null
}

export interface UpdateStudentInput {
  studentNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface CourseInput {
  name: string
  code: string
  description: string
  duration: string
  level: string
  status: CourseStatus
  startDate: string
  endDate: string
  passMark: number
  facilitatorId: string | null
}

export interface MaterialInput {
  courseId: string
  moduleId: string | null
  title: string
  description: string
  category: MaterialCategory
  file: UploadMeta
}

export interface AssessmentInput {
  courseId: string
  title: string
  type: AssessmentType
  instructions: string
  weight: number
  timeLimitMinutes: number | null
  maxAttempts: number
  resultRelease: ResultRelease
}

export interface QuestionInput {
  assessmentId: string
  prompt: string
  type: QuestionType
  marks: number
  options: { label: string; correct: boolean }[]
  acceptedAnswers: string[]
}

export interface DraftAnswerInput {
  questionId: string
  optionIds: string[]
  text: string
  fileName: string | null
}

export interface AnnouncementInput {
  courseId: string | null
  title: string
  body: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STAFF_ROLES = new Set<Role>(['super_admin', 'administrator', 'facilitator'])

function requireActor(db: Database, actorId: string) {
  const user = db.users.find((item) => item.id === actorId && item.status === 'active')
  if (!user) throw new AccessError('Your session is no longer active.')
  return user
}

function requireStaff(db: Database, actorId: string) {
  const user = requireActor(db, actorId)
  if (!isStaffRole(user.role)) throw new AccessError()
  return user
}

function requireCourseAccess(db: Database, user: User, courseId: string) {
  if (!canAccessCourse(db, user, courseId)) throw new AccessError()
}

function requireStudentVisible(db: Database, user: User, studentUserId: string) {
  if (!canSeeStudent(db, user, studentUserId)) throw new AccessError()
}

function audit(
  db: Database,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  previousValue: string | null,
  newValue: string | null,
) {
  db.auditLogs.unshift({
    id: createId('aud'),
    actorUserId: actorId,
    action,
    entity,
    entityId,
    timestamp: new Date().toISOString(),
    previousValue,
    newValue,
  })
}

function notify(db: Database, userId: string, title: string, body: string) {
  db.notifications.unshift({
    id: createId('ntf'),
    userId,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

function assertEmail(email: string) {
  if (!EMAIL_PATTERN.test(email.trim())) throw new ValidationError('Enter a valid email address.')
}

function assertPhone(phone: string) {
  if (phone.replace(/\D/g, '').length < 7) throw new ValidationError('Enter a valid phone number.')
}

function assertPerson(firstName: string, lastName: string) {
  if (!firstName.trim() || !lastName.trim()) throw new ValidationError('Enter a first name and a last name.')
}

function syncCourseResult(db: Database, studentUserId: string, courseId: string) {
  const enrolment = db.enrolments.find(
    (item) => item.studentUserId === studentUserId && item.courseId === courseId && item.status !== 'withdrawn',
  )
  const course = courseById(db, courseId)
  if (!enrolment || !course) return
  const assessments = db.assessments.filter((item) => item.courseId === courseId && item.status === 'published')
  const score = calculateCourseScore(
    assessments.map((assessment) => {
      const attempt = db.assessmentAttempts
        .filter(
          (item) =>
            item.assessmentId === assessment.id &&
            item.studentUserId === studentUserId &&
            item.released &&
            item.percentage !== null,
        )
        .sort((left, right) => (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''))[0]
      return { assessmentId: assessment.id, weight: assessment.weight, percentage: attempt?.percentage ?? null }
    }),
    course.passMark,
  )
  const existing = db.courseResults.find((item) => item.enrolmentId === enrolment.id)
  const next = {
    percentage: score.percentage,
    status: score.status,
    calculatedAt: new Date().toISOString(),
  }
  if (existing) Object.assign(existing, next)
  else {
    db.courseResults.push({ id: createId('cr'), enrolmentId: enrolment.id, ...next })
  }
}

function recomputeAttempt(db: Database, attempt: AssessmentAttempt, assessment: Assessment) {
  const questions = db.questions.filter((question) => question.assessmentId === assessment.id)
  const answers = db.assessmentAnswers.filter((answer) => answer.attemptId === attempt.id)
  const summary = summariseMarks(
    questions.map((question) => {
      const answer = answers.find((item) => item.questionId === question.id)
      return {
        questionId: question.id,
        awarded: answer?.awardedMarks ?? null,
        available: question.marks,
        autoMarked: answer?.autoMarked ?? false,
      }
    }),
  )
  const wasReleased = attempt.released
  attempt.score = summary.awarded
  attempt.maxScore = summary.available
  attempt.percentage = summary.percentage
  if (summary.pendingManual) {
    attempt.status = attempt.submittedAt ? 'submitted' : 'started'
    attempt.released = false
    return false
  }
  if (assessment.resultRelease === 'immediate') {
    attempt.status = 'marked'
    attempt.released = true
    return !wasReleased
  }
  if (!wasReleased) {
    attempt.status = 'marked'
    attempt.released = false
  }
  return false
}

function ensureTemplate(db: Database, courseId: string, courseName: string) {
  const existing = db.certificateTemplates.find((template) => template.courseId === courseId)
  if (existing) return existing
  const director = db.users.find((user) => user.role === 'super_admin')
  const template = {
    id: createId('tpl'),
    courseId,
    name: `${courseName} certificate`,
    signatory: director ? fullName(director) : 'STK College',
    signatoryTitle: 'Academic Director',
  }
  db.certificateTemplates.push(template)
  return template
}

function writeCertificate(
  db: Database,
  actorId: string,
  student: User,
  courseId: string,
  completionDate: string,
  result: string,
  requestedNumber: string,
) {
  const course = courseById(db, courseId)
  if (!course) throw new ValidationError('That course could not be found.')
  const number =
    requestedNumber ||
    nextCertificateNumber(
      course.certificatePattern,
      course.code,
      db.settings.certificateYear,
      db.certificates.map((certificate) => certificate.certificateNumber),
    )
  if (db.certificates.some((certificate) => certificate.certificateNumber.toUpperCase() === number.toUpperCase())) {
    throw new ValidationError(`Certificate number ${number} is already used.`)
  }
  const template = ensureTemplate(db, course.id, course.name)
  const certificate = {
    id: createId('cert'),
    templateId: template.id,
    studentUserId: student.id,
    courseId: course.id,
    certificateNumber: number.toUpperCase(),
    studentName: fullName(student),
    courseName: course.name,
    courseCode: course.code,
    completionDate,
    result,
    status: 'valid' as const,
    issuedAt: new Date().toISOString(),
  }
  db.certificates.unshift(certificate)
  const enrolment = db.enrolments.find((item) => item.studentUserId === student.id && item.courseId === course.id)
  if (enrolment && enrolment.status === 'active') enrolment.status = 'completed'
  notify(db, student.id, 'Certificate issued', `Your ${course.name} certificate ${certificate.certificateNumber} is ready.`)
  audit(db, actorId, 'Certificate generated', 'certificates', certificate.id, null, certificate.certificateNumber)
  return certificate
}

export function authenticate(email: string, password: string) {
  const user = portalStore.get().users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || password !== DEMO_PASSWORD) throw new ValidationError('Email or password is incorrect.')
  if (user.status !== 'active') {
    throw new ValidationError('This account is deactivated. Ask the college office for help.')
  }
  return user
}

export function createStudent(actorId: string, input: CreateStudentInput) {
  let createdId = ''
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    assertPerson(input.firstName, input.lastName)
    assertEmail(input.email)
    assertPhone(input.phone)
    const email = input.email.trim().toLowerCase()
    const studentNumber = input.studentNumber.trim().toUpperCase()
    if (!studentNumber) throw new ValidationError('Enter a student number.')
    if (db.users.some((user) => user.email.toLowerCase() === email)) {
      throw new ValidationError('A student with this email already exists.')
    }
    if (db.studentProfiles.some((profile) => profile.studentNumber.toLowerCase() === studentNumber.toLowerCase())) {
      throw new ValidationError('A student with this student number already exists.')
    }
    if (input.courseId) requireCourseAccess(db, actor, input.courseId)
    createdId = createId('u')
    db.users.push({
      id: createdId,
      email,
      role: 'student',
      status: 'active',
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      createdAt: new Date().toISOString(),
    })
    db.studentProfiles.push({ id: createId('stu'), userId: createdId, studentNumber })
    if (input.courseId) {
      db.enrolments.push({
        id: createId('e'),
        studentUserId: createdId,
        courseId: input.courseId,
        status: 'active',
        enrolledAt: input.enrolmentDate || new Date().toISOString().slice(0, 10),
      })
    }
    notify(db, createdId, 'Welcome to STK College', 'Your student account is ready. Sign in with the email address the college used.')
    audit(db, actor.id, 'User created', 'users', createdId, null, `${input.firstName.trim()} ${input.lastName.trim()}`)
  })
  return createdId
}

export function updateStudent(actorId: string, studentUserId: string, input: UpdateStudentInput) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireStudentVisible(db, actor, studentUserId)
    const student = userById(db, studentUserId)
    const profile = db.studentProfiles.find((item) => item.userId === studentUserId)
    if (!student || student.role !== 'student' || !profile) throw new ValidationError('That student could not be found.')
    assertPerson(input.firstName, input.lastName)
    assertEmail(input.email)
    assertPhone(input.phone)
    const email = input.email.trim().toLowerCase()
    const studentNumber = input.studentNumber.trim().toUpperCase()
    if (db.users.some((user) => user.id !== student.id && user.email.toLowerCase() === email)) {
      throw new ValidationError('Another account already uses that email.')
    }
    if (
      db.studentProfiles.some(
        (item) => item.userId !== student.id && item.studentNumber.toLowerCase() === studentNumber.toLowerCase(),
      )
    ) {
      throw new ValidationError('Another student already uses that student number.')
    }
    const previous = `${fullName(student)} · ${profile.studentNumber}`
    student.firstName = input.firstName.trim()
    student.lastName = input.lastName.trim()
    student.email = email
    student.phone = input.phone.trim()
    profile.studentNumber = studentNumber
    audit(db, actor.id, 'Student updated', 'users', student.id, previous, `${fullName(student)} · ${studentNumber}`)
  })
}

export function setAccountStatus(actorId: string, userId: string, status: 'active' | 'inactive') {
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (!canChangeAccountStatus(actor.role)) throw new AccessError()
    if (actor.id === userId) throw new ValidationError('You cannot change your own account status.')
    const user = userById(db, userId)
    if (!user) throw new ValidationError('That account could not be found.')
    if (actor.role === 'administrator' && user.role !== 'student') {
      throw new AccessError('Administrators can activate or deactivate student accounts.')
    }
    const previous = user.status
    user.status = status
    audit(db, actor.id, 'Account status changed', 'users', user.id, previous, status)
  })
}

export function setStaffRole(actorId: string, userId: string, role: Role) {
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (!canManageUsers(actor.role)) throw new AccessError()
    if (actor.id === userId) throw new ValidationError('You cannot change your own role.')
    if (!STAFF_ROLES.has(role)) throw new ValidationError('Choose a staff role.')
    const user = userById(db, userId)
    if (!user || !STAFF_ROLES.has(user.role)) throw new ValidationError('Only staff roles can be changed here.')
    const previous = user.role
    user.role = role
    audit(db, actor.id, 'Staff permission changed', 'users', user.id, previous, role)
  })
}

export function updateOwnPhone(userId: string, phone: string) {
  assertPhone(phone)
  portalStore.update((db) => {
    const user = requireActor(db, userId)
    user.phone = phone.trim()
  })
}

export function importStudents(actorId: string, rows: StudentImportRow[]) {
  const valid = rows.filter((row) => row.errors.length === 0 && row.courseId)
  if (valid.length === 0) throw new ValidationError('There are no valid rows to import.')
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    valid.forEach((row) => {
      if (!row.courseId) return
      requireCourseAccess(db, actor, row.courseId)
      const email = row.email.toLowerCase()
      if (db.users.some((user) => user.email.toLowerCase() === email)) {
        throw new ValidationError(`Row ${row.rowNumber} duplicates an existing email. Nothing was imported.`)
      }
      if (db.studentProfiles.some((profile) => profile.studentNumber.toLowerCase() === row.studentNumber.toLowerCase())) {
        throw new ValidationError(`Row ${row.rowNumber} duplicates an existing student number. Nothing was imported.`)
      }
      const userId = createId('u')
      db.users.push({
        id: userId,
        email,
        role: 'student',
        status: 'active',
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        createdAt: new Date().toISOString(),
      })
      db.studentProfiles.push({ id: createId('stu'), userId, studentNumber: row.studentNumber.toUpperCase() })
      db.enrolments.push({
        id: createId('e'),
        studentUserId: userId,
        courseId: row.courseId,
        status: 'active',
        enrolledAt: row.enrolmentDate,
      })
      notify(db, userId, 'Welcome to STK College', `You are enrolled and can sign in with ${email}.`)
    })
    audit(db, actor.id, 'Bulk import performed', 'users', 'student-import', null, `${valid.length} students imported`)
  })
  return valid.length
}

export function createCourse(actorId: string, input: CourseInput) {
  let courseId = ''
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (!canManageCourses(actor.role)) throw new AccessError()
    const code = input.code.trim().toUpperCase()
    if (!input.name.trim() || !code) throw new ValidationError('Enter a course name and code.')
    if (db.courses.some((course) => course.code.toUpperCase() === code)) {
      throw new ValidationError('That course code is already used.')
    }
    if (!Number.isInteger(input.passMark) || input.passMark < 0 || input.passMark > 100) {
      throw new ValidationError('Pass mark must be a whole number from 0 to 100.')
    }
    courseId = createId('c')
    db.courses.push({
      id: courseId,
      name: input.name.trim(),
      code,
      description: input.description.trim(),
      duration: input.duration.trim() || '12 weeks',
      level: input.level.trim() || 'Beginner',
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      passMark: input.passMark,
      certificatePattern: 'STK-{CODE}-{YEAR}-{SEQ}',
    })
    if (input.facilitatorId) {
      const facilitator = userById(db, input.facilitatorId)
      if (!facilitator || facilitator.role !== 'facilitator') throw new ValidationError('Choose a facilitator.')
      db.courseStaff.push({ id: createId('cs'), courseId, staffUserId: facilitator.id })
    }
    audit(db, actor.id, 'Course created', 'courses', courseId, null, input.name.trim())
  })
  return courseId
}

export function updateCourse(actorId: string, courseId: string, input: CourseInput) {
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (!canManageCourses(actor.role)) throw new AccessError()
    const course = courseById(db, courseId)
    if (!course) throw new ValidationError('That course could not be found.')
    const code = input.code.trim().toUpperCase()
    if (db.courses.some((item) => item.id !== course.id && item.code.toUpperCase() === code)) {
      throw new ValidationError('That course code is already used.')
    }
    const previous = course.name
    course.name = input.name.trim()
    course.code = code
    course.description = input.description.trim()
    course.duration = input.duration.trim()
    course.level = input.level.trim()
    course.status = input.status
    course.startDate = input.startDate
    course.endDate = input.endDate
    course.passMark = input.passMark
    db.courseStaff = db.courseStaff.filter((row) => row.courseId !== course.id)
    if (input.facilitatorId) {
      db.courseStaff.push({ id: createId('cs'), courseId: course.id, staffUserId: input.facilitatorId })
    }
    audit(db, actor.id, 'Course updated', 'courses', course.id, previous, course.name)
  })
}

export function saveCourseRules(
  actorId: string,
  courseId: string,
  passMark: number,
  weights: { assessmentId: string; weight: number }[],
) {
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (!canManageSettings(actor.role)) throw new AccessError()
    const course = courseById(db, courseId)
    if (!course) throw new ValidationError('That course could not be found.')
    if (!Number.isInteger(passMark) || passMark < 0 || passMark > 100) {
      throw new ValidationError('Pass mark must be a whole number from 0 to 100.')
    }
    const published = db.assessments.filter((assessment) => assessment.courseId === course.id && assessment.status !== 'draft')
    const total = weights.reduce((sum, item) => sum + item.weight, 0)
    if (published.length > 0 && total !== 100) {
      throw new ValidationError('Assessment weights must add up to 100.')
    }
    weights.forEach((item) => {
      if (!Number.isInteger(item.weight) || item.weight < 0 || item.weight > 100) {
        throw new ValidationError('Each weight must be a whole number from 0 to 100.')
      }
      const assessment = db.assessments.find((assessmentItem) => assessmentItem.id === item.assessmentId)
      if (!assessment || assessment.courseId !== course.id) throw new AccessError()
      assessment.weight = item.weight
    })
    const previous = String(course.passMark)
    course.passMark = passMark
    db.enrolments
      .filter((enrolment) => enrolment.courseId === course.id)
      .forEach((enrolment) => syncCourseResult(db, enrolment.studentUserId, course.id))
    audit(db, actor.id, 'Course rules updated', 'courses', course.id, `Pass mark ${previous}`, `Pass mark ${passMark}`)
  })
}

export function enrolStudent(actorId: string, studentUserId: string, courseId: string, enrolmentDate: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireCourseAccess(db, actor, courseId)
    requireStudentVisible(db, actor, studentUserId)
    const student = userById(db, studentUserId)
    const course = courseById(db, courseId)
    if (!student || student.role !== 'student' || !course) throw new ValidationError('Choose a student and a course.')
    const existing = db.enrolments.find((item) => item.studentUserId === student.id && item.courseId === course.id)
    if (existing && existing.status !== 'withdrawn') {
      throw new ValidationError('This student is already enrolled in that course.')
    }
    if (existing) {
      existing.status = 'active'
      existing.enrolledAt = enrolmentDate
    } else {
      db.enrolments.push({
        id: createId('e'),
        studentUserId: student.id,
        courseId: course.id,
        status: 'active',
        enrolledAt: enrolmentDate,
      })
    }
    notify(db, student.id, 'New course enrolment', `You can now open ${course.name}.`)
    audit(db, actor.id, 'Student enrolled', 'enrolments', course.id, null, `${fullName(student)} · ${course.name}`)
  })
}

export function setEnrolmentStatus(actorId: string, enrolmentId: string, status: EnrolmentStatus) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const enrolment = db.enrolments.find((item) => item.id === enrolmentId)
    if (!enrolment) throw new ValidationError('That enrolment could not be found.')
    requireCourseAccess(db, actor, enrolment.courseId)
    const previous = enrolment.status
    enrolment.status = status
    audit(db, actor.id, 'Enrolment updated', 'enrolments', enrolment.id, previous, status)
  })
}

export function addMaterial(actorId: string, input: MaterialInput) {
  const fileError = validateUpload(input.file, portalStore.get().settings.maxUploadMb)
  if (fileError) throw new ValidationError(fileError)
  if (!input.title.trim()) throw new ValidationError('Enter a title for the material.')
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireCourseAccess(db, actor, input.courseId)
    const materialId = createId('mat')
    const fileName = sanitiseFileName(input.file.name)
    db.materials.unshift({
      id: materialId,
      courseId: input.courseId,
      moduleId: input.moduleId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      fileName,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
      uploadedBy: actor.id,
      uploadedAt: new Date().toISOString(),
      status: 'published',
      visibilityDate: null,
    })
    db.materialVersions.unshift({
      id: createId('mv'),
      materialId,
      fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: actor.id,
      note: 'Initial upload',
    })
    db.enrolments
      .filter((enrolment) => enrolment.courseId === input.courseId && enrolment.status === 'active')
      .forEach((enrolment) => notify(db, enrolment.studentUserId, 'New course material', input.title.trim()))
    audit(db, actor.id, 'Material uploaded', 'materials', materialId, null, input.title.trim())
  })
}

export function archiveMaterial(actorId: string, materialId: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const material = db.materials.find((item) => item.id === materialId)
    if (!material) throw new ValidationError('That material could not be found.')
    requireCourseAccess(db, actor, material.courseId)
    const previous = material.status
    material.status = material.status === 'archived' ? 'published' : 'archived'
    audit(db, actor.id, 'Material updated', 'materials', material.id, previous, material.status)
  })
}

export function createAssessment(actorId: string, input: AssessmentInput) {
  let assessmentId = ''
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireCourseAccess(db, actor, input.courseId)
    if (!input.title.trim()) throw new ValidationError('Enter an assessment title.')
    if (!Number.isInteger(input.weight) || input.weight < 0 || input.weight > 100) {
      throw new ValidationError('Weight must be a whole number from 0 to 100.')
    }
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
      throw new ValidationError('Allow at least one attempt.')
    }
    assessmentId = createId('a')
    db.assessments.push({
      id: assessmentId,
      courseId: input.courseId,
      title: input.title.trim(),
      type: input.type,
      instructions: input.instructions.trim(),
      weight: input.weight,
      timeLimitMinutes: input.timeLimitMinutes,
      maxAttempts: input.maxAttempts,
      resultRelease: input.resultRelease,
      status: 'draft',
      availableFrom: new Date().toISOString().slice(0, 10),
      availableUntil: `${db.settings.certificateYear}-12-15`,
    })
    audit(db, actor.id, 'Assessment created', 'assessments', assessmentId, null, input.title.trim())
  })
  return assessmentId
}

export function addQuestion(actorId: string, input: QuestionInput) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const assessment = db.assessments.find((item) => item.id === input.assessmentId)
    if (!assessment) throw new ValidationError('That assessment could not be found.')
    requireCourseAccess(db, actor, assessment.courseId)
    if (!input.prompt.trim()) throw new ValidationError('Enter the question.')
    if (!Number.isInteger(input.marks) || input.marks < 1) throw new ValidationError('Enter a mark value of at least 1.')
    const objective = input.type === 'multiple_choice' || input.type === 'true_false' || input.type === 'multiple_answer'
    if (objective) {
      const filled = input.options.filter((option) => option.label.trim())
      if (filled.length < 2) throw new ValidationError('Add at least two options.')
      const correctCount = filled.filter((option) => option.correct).length
      if (input.type === 'multiple_answer' && correctCount < 1) {
        throw new ValidationError('Mark at least one correct option.')
      }
      if (input.type !== 'multiple_answer' && correctCount !== 1) {
        throw new ValidationError('Mark exactly one correct option.')
      }
    }
    if (input.type === 'short_answer' && input.acceptedAnswers.every((answer) => !answer.trim())) {
      throw new ValidationError('Enter the accepted short answer.')
    }
    const order = db.questions.filter((question) => question.assessmentId === assessment.id).length + 1
    const questionId = createId('q')
    const question: Question = {
      id: questionId,
      assessmentId: assessment.id,
      prompt: input.prompt.trim(),
      type: input.type,
      marks: input.marks,
      order,
      acceptedAnswers: input.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean),
    }
    db.questions.push(question)
    if (objective) {
      input.options
        .filter((option) => option.label.trim())
        .forEach((option) => {
          db.questionOptions.push({
            id: createId('opt'),
            questionId,
            label: option.label.trim(),
            isCorrect: option.correct,
          })
        })
    }
    audit(db, actor.id, 'Assessment changed', 'questions', questionId, null, input.prompt.trim())
  })
}

export function setAssessmentStatus(actorId: string, assessmentId: string, status: AssessmentStatus) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const assessment = db.assessments.find((item) => item.id === assessmentId)
    if (!assessment) throw new ValidationError('That assessment could not be found.')
    requireCourseAccess(db, actor, assessment.courseId)
    if (status === 'published' && !db.questions.some((question) => question.assessmentId === assessment.id)) {
      throw new ValidationError('Add at least one question before publishing.')
    }
    const previous = assessment.status
    assessment.status = status
    audit(db, actor.id, 'Assessment changed', 'assessments', assessment.id, previous, status)
  })
}

export function startAttempt(studentId: string, assessmentId: string) {
  let attemptId = ''
  portalStore.update((db) => {
    const student = requireActor(db, studentId)
    if (student.role !== 'student') throw new AccessError()
    const assessment = db.assessments.find((item) => item.id === assessmentId)
    if (!assessment || assessment.status !== 'published') throw new AccessError()
    if (!studentCanAccessCourse(db, student.id, assessment.courseId)) throw new AccessError()
    const window = assessmentWindow(assessment)
    if (window === 'upcoming') throw new ValidationError('This assessment is not open yet.')
    if (window === 'closed') throw new ValidationError('This assessment has closed.')
    const questions = db.questions.filter((question) => question.assessmentId === assessment.id)
    if (questions.length === 0) throw new ValidationError('This assessment has no questions yet.')
    const attempts = db.assessmentAttempts.filter(
      (attempt) => attempt.assessmentId === assessment.id && attempt.studentUserId === student.id,
    )
    const open = attempts.find((attempt) => attempt.status === 'started')
    if (open) {
      attemptId = open.id
      return
    }
    if (attempts.some((attempt) => attempt.status === 'submitted')) {
      throw new ValidationError('Your last attempt is still being marked.')
    }
    if (attempts.length >= assessment.maxAttempts) throw new ValidationError('You have used every attempt.')
    attemptId = createId('att')
    db.assessmentAttempts.push({
      id: attemptId,
      assessmentId: assessment.id,
      studentUserId: student.id,
      status: 'started',
      startedAt: new Date().toISOString(),
      submittedAt: null,
      score: null,
      maxScore: null,
      percentage: null,
      released: false,
    })
    questions.forEach((question) => {
      db.assessmentAnswers.push({
        id: createId('ans'),
        attemptId,
        questionId: question.id,
        optionIds: [],
        text: '',
        fileName: null,
        awardedMarks: null,
        feedback: '',
        autoMarked: false,
      })
    })
  })
  return attemptId
}

export function saveDraft(studentId: string, attemptId: string, drafts: DraftAnswerInput[]) {
  portalStore.update((db) => {
    const student = requireActor(db, studentId)
    const attempt = db.assessmentAttempts.find((item) => item.id === attemptId)
    if (!attempt || attempt.studentUserId !== student.id || attempt.status !== 'started') throw new AccessError()
    drafts.forEach((draft) => {
      const answer = db.assessmentAnswers.find(
        (item) => item.attemptId === attempt.id && item.questionId === draft.questionId,
      )
      if (!answer) return
      answer.optionIds = draft.optionIds
      answer.text = draft.text
      answer.fileName = draft.fileName
    })
  })
}

export function submitAttempt(studentId: string, attemptId: string) {
  portalStore.update((db) => {
    const student = requireActor(db, studentId)
    if (student.role !== 'student') throw new AccessError()
    const attempt = db.assessmentAttempts.find((item) => item.id === attemptId)
    if (!attempt || attempt.studentUserId !== student.id) throw new AccessError()
    if (attempt.status !== 'started') throw new ValidationError('This attempt has already been submitted.')
    const assessment = db.assessments.find((item) => item.id === attempt.assessmentId)
    if (!assessment) throw new ValidationError('That assessment could not be found.')
    const questions = db.questions.filter((question) => question.assessmentId === assessment.id)
    questions.forEach((question) => {
      const answer = db.assessmentAnswers.find(
        (item) => item.attemptId === attempt.id && item.questionId === question.id,
      )
      if (!answer) return
      const given: GivenAnswer = { questionId: question.id, optionIds: answer.optionIds, text: answer.text }
      const marked = markQuestion(
        {
          id: question.id,
          type: question.type,
          marks: question.marks,
          correctOptionIds: db.questionOptions
            .filter((option) => option.questionId === question.id && option.isCorrect)
            .map((option) => option.id),
          acceptedAnswers: question.acceptedAnswers,
        },
        given,
      )
      answer.awardedMarks = marked.awarded
      answer.autoMarked = marked.autoMarked
    })
    attempt.submittedAt = new Date().toISOString()
    const newlyReleased = recomputeAttempt(db, attempt, assessment)
    audit(db, student.id, 'Assessment submitted', 'assessment_attempts', attempt.id, null, assessment.title)
    if (newlyReleased) {
      notify(db, student.id, 'Result released', `${assessment.title}: ${attempt.percentage}%`)
      syncCourseResult(db, student.id, assessment.courseId)
    } else {
      notify(db, student.id, 'Assessment submitted', `${assessment.title} is waiting for review.`)
    }
  })
}

export function saveManualMark(actorId: string, answerId: string, marks: number, feedback: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const answer = db.assessmentAnswers.find((item) => item.id === answerId)
    const attempt = answer ? db.assessmentAttempts.find((item) => item.id === answer.attemptId) : undefined
    const question = answer ? db.questions.find((item) => item.id === answer.questionId) : undefined
    const assessment = attempt ? db.assessments.find((item) => item.id === attempt.assessmentId) : undefined
    if (!answer || !attempt || !question || !assessment) throw new ValidationError('That submission could not be found.')
    requireCourseAccess(db, actor, assessment.courseId)
    if (question.type !== 'long_answer' && question.type !== 'file_submission') {
      throw new ValidationError('Objective questions are marked automatically.')
    }
    if (!Number.isInteger(marks) || marks < 0 || marks > question.marks) {
      throw new ValidationError(`Enter a whole mark from 0 to ${question.marks}.`)
    }
    const previous = answer.awardedMarks === null ? 'Unmarked' : String(answer.awardedMarks)
    answer.awardedMarks = marks
    answer.feedback = feedback.trim()
    answer.autoMarked = false
    const newlyReleased = recomputeAttempt(db, attempt, assessment)
    audit(db, actor.id, 'Result changed', 'assessment_answers', answer.id, previous, String(marks))
    if (newlyReleased) {
      notify(db, attempt.studentUserId, 'Result released', `${assessment.title}: ${attempt.percentage}%`)
    }
    syncCourseResult(db, attempt.studentUserId, assessment.courseId)
  })
}

export function releaseAttempt(actorId: string, attemptId: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const attempt = db.assessmentAttempts.find((item) => item.id === attemptId)
    const assessment = attempt ? db.assessments.find((item) => item.id === attempt.assessmentId) : undefined
    if (!attempt || !assessment) throw new ValidationError('That submission could not be found.')
    requireCourseAccess(db, actor, assessment.courseId)
    const pending = db.questions
      .filter((question) => question.assessmentId === assessment.id)
      .some((question) => {
        const answer = db.assessmentAnswers.find(
          (item) => item.attemptId === attempt.id && item.questionId === question.id,
        )
        return answer?.awardedMarks === null || answer?.awardedMarks === undefined
      })
    if (pending) throw new ValidationError('Mark the open responses before releasing the result.')
    if (attempt.released) return
    attempt.released = true
    attempt.status = 'reviewed'
    notify(db, attempt.studentUserId, 'Result released', `${assessment.title}: ${attempt.percentage}%`)
    syncCourseResult(db, attempt.studentUserId, assessment.courseId)
    audit(db, actor.id, 'Result released', 'assessment_attempts', attempt.id, 'Held for review', `${attempt.percentage}%`)
  })
}

export function issueCertificate(actorId: string, studentUserId: string, courseId: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireCourseAccess(db, actor, courseId)
    requireStudentVisible(db, actor, studentUserId)
    const student = userById(db, studentUserId)
    const course = courseById(db, courseId)
    if (!student || !course) throw new ValidationError('Choose a student and a course.')
    const enrolment = db.enrolments.find((item) => item.studentUserId === student.id && item.courseId === course.id)
    if (!enrolment || enrolment.status === 'suspended' || enrolment.status === 'withdrawn') {
      throw new ValidationError('The student does not have an active enrolment.')
    }
    const existing = db.certificates.find(
      (certificate) =>
        certificate.studentUserId === student.id && certificate.courseId === course.id && certificate.status === 'valid',
    )
    if (existing) throw new ValidationError('A valid certificate already exists for this student and course.')
    const result = db.courseResults.find((item) => item.enrolmentId === enrolment.id)
    if (!result || result.status !== 'pass' || result.percentage === null) {
      throw new ValidationError('This student has not passed the course yet.')
    }
    writeCertificate(db, actor.id, student, course.id, new Date().toISOString().slice(0, 10), `${result.percentage}%`, '')
  })
}

export function revokeCertificate(actorId: string, certificateId: string) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const certificate = db.certificates.find((item) => item.id === certificateId)
    if (!certificate) throw new ValidationError('That certificate could not be found.')
    requireCourseAccess(db, actor, certificate.courseId)
    if (certificate.status === 'revoked') return
    certificate.status = 'revoked'
    audit(db, actor.id, 'Certificate revoked', 'certificates', certificate.id, 'Valid', 'Revoked')
  })
}

export function importCertificates(actorId: string, rows: CertificateImportRow[]) {
  const valid = rows.filter((row) => row.errors.length === 0 && row.studentUserId && row.courseId)
  if (valid.length === 0) throw new ValidationError('There are no valid rows to import.')
  let imported = 0
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    valid.forEach((row) => {
      if (!row.studentUserId || !row.courseId) return
      requireCourseAccess(db, actor, row.courseId)
      const student = userById(db, row.studentUserId)
      if (!student) return
      const already = db.certificates.some(
        (certificate) =>
          certificate.studentUserId === student.id &&
          certificate.courseId === row.courseId &&
          certificate.status === 'valid',
      )
      if (already) return
      writeCertificate(db, actor.id, student, row.courseId, row.completionDate, row.result, row.certificateNumber)
      imported += 1
    })
    audit(db, actor.id, 'Bulk import performed', 'certificates', 'certificate-import', null, `${imported} certificates imported`)
  })
  return imported
}

export function createSession(actorId: string, courseId: string, title: string, date: string) {
  let sessionId = ''
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireCourseAccess(db, actor, courseId)
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError('Enter a session title and a date.')
    }
    sessionId = createId('ses')
    db.attendanceSessions.unshift({ id: sessionId, courseId, title: title.trim(), date })
    audit(db, actor.id, 'Attendance session created', 'attendance_sessions', sessionId, null, title.trim())
  })
  return sessionId
}

export function saveAttendance(
  actorId: string,
  sessionId: string,
  records: { studentUserId: string; status: AttendanceStatus }[],
) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const session = db.attendanceSessions.find((item) => item.id === sessionId)
    if (!session) throw new ValidationError('That session could not be found.')
    requireCourseAccess(db, actor, session.courseId)
    records.forEach((record) => {
      const existing = db.attendanceRecords.find(
        (item) => item.sessionId === session.id && item.studentUserId === record.studentUserId,
      )
      if (existing) existing.status = record.status
      else {
        db.attendanceRecords.push({
          id: createId('ar'),
          sessionId: session.id,
          studentUserId: record.studentUserId,
          status: record.status,
        })
      }
    })
    audit(db, actor.id, 'Attendance recorded', 'attendance_sessions', session.id, null, `${records.length} learners`)
  })
}

export function createAnnouncement(actorId: string, input: AnnouncementInput) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    if (!input.title.trim() || !input.body.trim()) throw new ValidationError('Enter a title and a message.')
    if (!input.courseId && !canPostSystemAnnouncement(actor.role)) {
      throw new AccessError('Only administrators can post a college-wide announcement.')
    }
    if (input.courseId) requireCourseAccess(db, actor, input.courseId)
    const announcement: Announcement = {
      id: createId('ann'),
      courseId: input.courseId,
      title: input.title.trim(),
      body: input.body.trim(),
      publishedAt: new Date().toISOString(),
      authorUserId: actor.id,
    }
    db.announcements.unshift(announcement)
    const recipients = input.courseId
      ? db.enrolments.filter((enrolment) => enrolment.courseId === input.courseId && enrolment.status === 'active')
      : db.enrolments.filter((enrolment) => enrolment.status === 'active')
    const seen = new Set<string>()
    recipients.forEach((enrolment) => {
      if (seen.has(enrolment.studentUserId)) return
      seen.add(enrolment.studentUserId)
      notify(db, enrolment.studentUserId, input.title.trim(), input.body.trim())
    })
    audit(db, actor.id, 'Announcement published', 'announcements', announcement.id, null, announcement.title)
  })
}

export function markNotificationsRead(userId: string) {
  portalStore.update((db) => {
    const user = requireActor(db, userId)
    db.notifications.forEach((notification) => {
      if (notification.userId === user.id) notification.read = true
    })
  })
}

export function resetDemoData() {
  portalStore.reset()
}

export function startConversation(actorId: string, courseId: string, body: string, studentUserId?: string) {
  const text = body.trim()
  if (!text) throw new ValidationError('Write a message.')
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    const course = courseById(db, courseId)
    if (!course) throw new ValidationError('Choose a course.')
    requireCourseAccess(db, actor, course.id)
    const studentId = actor.role === 'student' ? actor.id : studentUserId
    if (!studentId) throw new ValidationError('Choose a student.')
    if (actor.role !== 'student') requireStudentVisible(db, actor, studentId)
    const staffIds = db.courseStaff.filter((link) => link.courseId === course.id).map((link) => link.staffUserId)
    const participantIds = Array.from(new Set([studentId, actor.id, ...staffIds]))
    let thread = db.chatThreads.find(
      (item) => item.courseId === course.id && item.participantIds.includes(studentId) && item.participantIds.includes(actor.id),
    )
    if (!thread) {
      thread = {
        id: createId('thread'),
        courseId: course.id,
        subject: course.name,
        participantIds,
      }
      db.chatThreads.unshift(thread)
    } else {
      participantIds.forEach((id) => {
        if (!thread?.participantIds.includes(id)) thread?.participantIds.push(id)
      })
    }
    db.chatMessages.push({
      id: createId('msg'),
      threadId: thread.id,
      senderUserId: actor.id,
      body: text,
      createdAt: new Date().toISOString(),
    })
    thread.participantIds
      .filter((id) => id !== actor.id)
      .forEach((id) => notify(db, id, course.name, text.slice(0, 140)))
    audit(db, actor.id, 'Message sent', 'chat_threads', thread.id, null, course.name)
  })
}

export function sendChatMessage(actorId: string, threadId: string, body: string) {
  const text = body.trim()
  if (!text) throw new ValidationError('Write a message.')
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    const thread = db.chatThreads.find((item) => item.id === threadId)
    if (!thread || !visibleThreads(db, actor).some((item) => item.id === thread.id)) throw new AccessError()
    if (!thread.participantIds.includes(actor.id)) thread.participantIds.push(actor.id)
    db.chatMessages.push({
      id: createId('msg'),
      threadId: thread.id,
      senderUserId: actor.id,
      body: text,
      createdAt: new Date().toISOString(),
    })
    thread.participantIds
      .filter((id) => id !== actor.id)
      .forEach((id) => notify(db, id, thread.subject, text.slice(0, 140)))
    audit(db, actor.id, 'Message sent', 'chat_threads', thread.id, null, thread.subject)
  })
}

export function sendPortalEmail(actorId: string, toUserId: string, subject: string, body: string) {
  if (!subject.trim() || !body.trim()) throw new ValidationError('Enter a subject and a message.')
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    requireStudentVisible(db, actor, toUserId)
    const recipient = userById(db, toUserId)
    if (!recipient || recipient.role !== 'student') throw new ValidationError('Choose a student.')
    const email = {
      id: createId('mail'),
      fromUserId: actor.id,
      toUserId,
      subject: subject.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
      status: 'recorded' as const,
    }
    db.emails.unshift(email)
    notify(
      db,
      toUserId,
      subject.trim(),
      'A message was recorded in your portal inbox. No mail server is connected in this prototype.',
    )
    audit(db, actor.id, 'Email recorded', 'emails', email.id, null, email.subject)
  })
}

export function createTicket(
  actorId: string,
  input: { subject: string; body: string; category: TicketCategory; courseId: string | null },
) {
  if (!input.subject.trim() || !input.body.trim()) throw new ValidationError('Enter a subject and the details.')
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    if (actor.role !== 'student') throw new AccessError('Staff record issues through the import, or reply to a student ticket.')
    if (input.courseId) requireCourseAccess(db, actor, input.courseId)
    const now = new Date().toISOString()
    const ticket = {
      id: createId('tkt'),
      reporterUserId: actor.id,
      courseId: input.courseId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      category: input.category,
      status: 'open' as const,
      createdAt: now,
      updatedAt: now,
    }
    db.tickets.unshift(ticket)
    const courseStaff = input.courseId
      ? db.courseStaff.filter((link) => link.courseId === input.courseId).map((link) => link.staffUserId)
      : db.users.filter((person) => person.role === 'administrator' || person.role === 'super_admin').map((person) => person.id)
    courseStaff.forEach((id) => notify(db, id, 'New support ticket', ticket.subject))
    audit(db, actor.id, 'Ticket opened', 'tickets', ticket.id, null, ticket.subject)
  })
}

export function replyToTicket(actorId: string, ticketId: string, body: string) {
  const text = body.trim()
  if (!text) throw new ValidationError('Write a reply.')
  portalStore.update((db) => {
    const actor = requireActor(db, actorId)
    const ticket = db.tickets.find((item) => item.id === ticketId)
    if (!ticket || !visibleTickets(db, actor).some((item) => item.id === ticket.id)) throw new AccessError()
    db.ticketReplies.push({
      id: createId('tkt-reply'),
      ticketId: ticket.id,
      authorUserId: actor.id,
      body: text,
      createdAt: new Date().toISOString(),
    })
    ticket.updatedAt = new Date().toISOString()
    if (actor.id !== ticket.reporterUserId) notify(db, ticket.reporterUserId, 'Reply on your ticket', ticket.subject)
    audit(db, actor.id, 'Ticket reply', 'tickets', ticket.id, null, ticket.subject)
  })
}

export function setTicketStatus(actorId: string, ticketId: string, status: TicketStatus) {
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    const ticket = db.tickets.find((item) => item.id === ticketId)
    if (!ticket || !visibleTickets(db, actor).some((item) => item.id === ticket.id)) throw new AccessError()
    const previous = ticket.status
    ticket.status = status
    ticket.updatedAt = new Date().toISOString()
    notify(db, ticket.reporterUserId, 'Ticket updated', `${ticket.subject} is now ${status.replace('_', ' ')}.`)
    audit(db, actor.id, 'Ticket status changed', 'tickets', ticket.id, previous, status)
  })
}

export function importTickets(actorId: string, rows: TicketImportRow[]) {
  const valid = rows.filter((row) => row.errors.length === 0 && row.studentUserId && row.category)
  if (valid.length === 0) throw new ValidationError('There are no valid rows to import.')
  portalStore.update((db) => {
    const actor = requireStaff(db, actorId)
    valid.forEach((row) => {
      if (!row.studentUserId || !row.category) return
      requireStudentVisible(db, actor, row.studentUserId)
      if (row.courseId) requireCourseAccess(db, actor, row.courseId)
      const now = new Date().toISOString()
      db.tickets.unshift({
        id: createId('tkt'),
        reporterUserId: row.studentUserId,
        courseId: row.courseId,
        subject: row.subject,
        body: row.body,
        category: row.category,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })
    })
    audit(db, actor.id, 'Tickets imported', 'tickets', 'import', null, String(valid.length))
  })
  return valid.length
}

export function presentAnswer(answer: AssessmentAnswer, attempt: AssessmentAttempt, assessment: Assessment) {
  const showScore =
    attempt.status !== 'started' &&
    (attempt.released || (assessment.resultRelease === 'immediate' && answer.autoMarked))
  return {
    ...answer,
    awardedMarks: showScore ? answer.awardedMarks : null,
    feedback: attempt.released ? answer.feedback : '',
  }
}

export function studentNumberFor(userId: string) {
  return studentNumberOf(portalStore.get(), userId)
}

export function releasedAnswerKey(attempt: AssessmentAttempt, questionId: string) {
  if (!attempt.released) return null
  const db = portalStore.get()
  const question = db.questions.find((item) => item.id === questionId)
  if (!question) return null
  if (question.type === 'short_answer') return question.acceptedAnswers
  if (question.type === 'long_answer' || question.type === 'file_submission') return null
  return db.questionOptions
    .filter((option) => option.questionId === question.id && option.isCorrect)
    .map((option) => option.label)
}
