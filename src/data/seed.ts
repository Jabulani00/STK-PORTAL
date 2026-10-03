import announcements from './announcements.json' with { type: 'json' }
import assessmentAnswers from './assessment-answers.json' with { type: 'json' }
import assessmentAttempts from './assessment-attempts.json' with { type: 'json' }
import assessments from './assessments.json' with { type: 'json' }
import attendanceRecords from './attendance-records.json' with { type: 'json' }
import attendanceSessions from './attendance-sessions.json' with { type: 'json' }
import auditLogs from './audit-logs.json' with { type: 'json' }
import certificateTemplates from './certificate-templates.json' with { type: 'json' }
import certificates from './certificates.json' with { type: 'json' }
import chatMessages from './chat-messages.json' with { type: 'json' }
import chatThreads from './chat-threads.json' with { type: 'json' }
import courseModules from './course-modules.json' with { type: 'json' }
import courseResults from './course-results.json' with { type: 'json' }
import courseStaff from './course-staff.json' with { type: 'json' }
import courses from './courses.json' with { type: 'json' }
import emails from './emails.json' with { type: 'json' }
import enrolments from './enrolments.json' with { type: 'json' }
import materialVersions from './material-versions.json' with { type: 'json' }
import materials from './materials.json' with { type: 'json' }
import notifications from './notifications.json' with { type: 'json' }
import questionOptions from './question-options.json' with { type: 'json' }
import questions from './questions.json' with { type: 'json' }
import roles from './roles.json' with { type: 'json' }
import settings from './settings.json' with { type: 'json' }
import staffProfiles from './staff-profiles.json' with { type: 'json' }
import studentProfiles from './student-profiles.json' with { type: 'json' }
import ticketReplies from './ticket-replies.json' with { type: 'json' }
import tickets from './tickets.json' with { type: 'json' }
import users from './users.json' with { type: 'json' }
import type { Database } from '../types/index.ts'

export const seedDatabase = {
  users,
  roles,
  studentProfiles,
  staffProfiles,
  courses,
  courseModules,
  courseStaff,
  enrolments,
  materials,
  materialVersions,
  assessments,
  questions,
  questionOptions,
  assessmentAttempts,
  assessmentAnswers,
  courseResults,
  attendanceSessions,
  attendanceRecords,
  certificateTemplates,
  certificates,
  announcements,
  notifications,
  chatThreads,
  chatMessages,
  emails,
  tickets,
  ticketReplies,
  auditLogs,
  settings,
} as Database

export const SEED_VERSION = seedDatabase.settings.seedVersion
