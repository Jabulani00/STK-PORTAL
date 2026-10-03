export const STUDENT_IMPORT_COLUMNS = [
  'Student Number',
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Course',
  'Enrolment Date',
] as const

export const TICKET_IMPORT_COLUMNS = ['Student Number', 'Subject', 'Category', 'Course', 'Details'] as const

const TICKET_CATEGORIES = ['access', 'assessment', 'certificate', 'technical', 'other'] as const

export const CERTIFICATE_IMPORT_COLUMNS = [
  'Student Number',
  'Student Name',
  'Course',
  'Completion Date',
  'Result',
  'Certificate Number',
] as const

export interface StudentImportContext {
  studentNumbers: string[]
  emails: string[]
  courses: { id: string; code: string; name: string }[]
}

export interface StudentImportRow {
  rowNumber: number
  studentNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
  course: string
  courseId: string | null
  enrolmentDate: string
  errors: string[]
}

export interface TicketImportContext {
  students: { userId: string; studentNumber: string; name: string }[]
  courses: { id: string; code: string; name: string }[]
}

export interface TicketImportRow {
  rowNumber: number
  studentNumber: string
  studentUserId: string | null
  subject: string
  category: (typeof TICKET_CATEGORIES)[number] | ''
  course: string
  courseId: string | null
  body: string
  errors: string[]
}

export interface CertificateImportContext {
  students: { userId: string; studentNumber: string; name: string }[]
  courses: { id: string; code: string; name: string }[]
  certificateNumbers: string[]
}

export interface CertificateImportRow {
  rowNumber: number
  studentNumber: string
  studentName: string
  studentUserId: string | null
  course: string
  courseId: string | null
  completionDate: string
  result: string
  certificateNumber: string
  errors: string[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseCsv(input: string) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char ?? ''
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell.trim())
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char ?? ''
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.some((value) => value.length > 0)) rows.push(row)
  }

  return rows
}

export function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) =>
          /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
        )
        .join(','),
    )
    .join('\n')
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function headersMatch(actual: string[], expected: readonly string[]) {
  if (actual.length !== expected.length) return false
  return expected.every((column, index) => actual[index]?.trim().toLowerCase() === column.toLowerCase())
}

function findCourse(courses: { id: string; code: string; name: string }[], value: string) {
  const needle = value.trim().toLowerCase()
  return courses.find(
    (course) => course.code.toLowerCase() === needle || course.name.toLowerCase() === needle,
  )
}

export function validateStudentImport(csvText: string, context: StudentImportContext) {
  const table = parseCsv(csvText)
  const header = table[0]
  if (!header || !headersMatch(header, STUDENT_IMPORT_COLUMNS)) {
    return {
      headerError: `The header row must be: ${STUDENT_IMPORT_COLUMNS.join(', ')}`,
      rows: [] as StudentImportRow[],
    }
  }

  const seenNumbers = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const existingNumbers = new Set(context.studentNumbers.map((value) => value.toLowerCase()))
  const existingEmails = new Set(context.emails.map((value) => value.toLowerCase()))
  const rows: StudentImportRow[] = []

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const [studentNumber = '', firstName = '', lastName = '', email = '', phone = '', course = '', enrolmentDate = ''] =
      cells
    const errors: string[] = []
    const numberKey = studentNumber.trim().toLowerCase()
    const emailKey = email.trim().toLowerCase()

    if (!studentNumber.trim()) errors.push('Student number is required.')
    if (!firstName.trim()) errors.push('First name is required.')
    if (!lastName.trim()) errors.push('Last name is required.')
    if (!EMAIL_PATTERN.test(email.trim())) errors.push('Email address is not valid.')
    if (phone.replace(/\D/g, '').length < 7) errors.push('Phone number is not valid.')
    const matchedCourse = findCourse(context.courses, course)
    if (!matchedCourse) errors.push('Course does not match a course code or name.')
    if (!isIsoDate(enrolmentDate.trim())) errors.push('Enrolment date must be YYYY-MM-DD.')

    if (numberKey && existingNumbers.has(numberKey)) {
      errors.push('A student with this student number already exists.')
    }
    if (emailKey && existingEmails.has(emailKey)) {
      errors.push('A student with this email already exists.')
    }
    const earlierNumber = numberKey ? seenNumbers.get(numberKey) : undefined
    if (earlierNumber) errors.push(`Student number duplicates row ${earlierNumber}.`)
    const earlierEmail = emailKey ? seenEmails.get(emailKey) : undefined
    if (earlierEmail) errors.push(`Email duplicates row ${earlierEmail}.`)
    if (numberKey && !seenNumbers.has(numberKey)) seenNumbers.set(numberKey, rowNumber)
    if (emailKey && !seenEmails.has(emailKey)) seenEmails.set(emailKey, rowNumber)

    rows.push({
      rowNumber,
      studentNumber: studentNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      course: course.trim(),
      courseId: matchedCourse?.id ?? null,
      enrolmentDate: enrolmentDate.trim(),
      errors,
    })
  })

  if (rows.length === 0) {
    return { headerError: 'The file has a header but no student rows.', rows }
  }

  return { headerError: null, rows }
}

export function validateCertificateImport(csvText: string, context: CertificateImportContext) {
  const table = parseCsv(csvText)
  const header = table[0]
  if (!header || !headersMatch(header, CERTIFICATE_IMPORT_COLUMNS)) {
    return {
      headerError: `The header row must be: ${CERTIFICATE_IMPORT_COLUMNS.join(', ')}`,
      rows: [] as CertificateImportRow[],
    }
  }

  const seenNumbers = new Set<string>()
  const rows: CertificateImportRow[] = []

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const [studentNumber = '', studentName = '', course = '', completionDate = '', result = '', certificateNumber = ''] =
      cells
    const errors: string[] = []
    const student = context.students.find(
      (item) => item.studentNumber.toLowerCase() === studentNumber.trim().toLowerCase(),
    )
    const matchedCourse = findCourse(context.courses, course)
    const number = certificateNumber.trim().toUpperCase()

    if (!student) errors.push('Student number does not match an existing student.')
    if (student && student.name.trim().toLowerCase() !== studentName.trim().toLowerCase()) {
      errors.push('Student name does not match this student number.')
    }
    if (!matchedCourse) errors.push('Course does not match a course code or name.')
    if (!isIsoDate(completionDate.trim())) errors.push('Completion date must be YYYY-MM-DD.')
    if (!result.trim()) errors.push('Result is required.')
    if (number) {
      if (!/^STK-[A-Z0-9]+-\d{4}-\d{6}$/.test(number)) {
        errors.push('Certificate number must look like STK-PY-2026-000001.')
      }
      if (context.certificateNumbers.some((existing) => existing.toUpperCase() === number) || seenNumbers.has(number)) {
        errors.push('Certificate number is already used.')
      }
      seenNumbers.add(number)
    }

    rows.push({
      rowNumber,
      studentNumber: studentNumber.trim(),
      studentName: studentName.trim(),
      studentUserId: student?.userId ?? null,
      course: course.trim(),
      courseId: matchedCourse?.id ?? null,
      completionDate: completionDate.trim(),
      result: result.trim(),
      certificateNumber: number,
      errors,
    })
  })

  if (rows.length === 0) {
    return { headerError: 'The file has a header but no certificate rows.', rows }
  }

  return { headerError: null, rows }
}

export function validateTicketImport(csvText: string, context: TicketImportContext) {
  const table = parseCsv(csvText)
  const header = table[0]
  if (!header || !headersMatch(header, TICKET_IMPORT_COLUMNS)) {
    return {
      headerError: `The header row must be: ${TICKET_IMPORT_COLUMNS.join(', ')}`,
      rows: [] as TicketImportRow[],
    }
  }

  const rows: TicketImportRow[] = []
  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const [studentNumber = '', subject = '', category = '', course = '', details = ''] = cells
    const errors: string[] = []
    const student = context.students.find(
      (item) => item.studentNumber.toLowerCase() === studentNumber.trim().toLowerCase(),
    )
    const categoryValue = category.trim().toLowerCase()
    const matchedCategory = TICKET_CATEGORIES.find((item) => item === categoryValue)
    const matchedCourse = course.trim() ? findCourse(context.courses, course) : null

    if (!student) errors.push('Student number does not match a student you can see.')
    if (!subject.trim()) errors.push('Subject is required.')
    if (!matchedCategory) errors.push('Category must be access, assessment, certificate, technical, or other.')
    if (course.trim() && !matchedCourse) errors.push('Course does not match a course code or name.')
    if (!details.trim()) errors.push('Details are required.')

    rows.push({
      rowNumber,
      studentNumber: studentNumber.trim(),
      studentUserId: student?.userId ?? null,
      subject: subject.trim(),
      category: matchedCategory ?? '',
      course: course.trim(),
      courseId: matchedCourse?.id ?? null,
      body: details.trim(),
      errors,
    })
  })

  if (rows.length === 0) {
    return { headerError: 'The file has a header but no ticket rows.', rows }
  }

  return { headerError: null, rows }
}
