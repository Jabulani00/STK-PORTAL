import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { HomeRedirect } from './home-redirect.tsx'
import { RequireAuth, RequireRoles } from './guards.tsx'
import { StudentShell } from '../layouts/student-shell.tsx'
import { StaffShell } from '../layouts/staff-shell.tsx'

function load<T extends Record<string, unknown>, K extends keyof T>(importer: () => Promise<T>, key: K) {
  return lazy(() => importer().then((module) => ({ default: module[key] as ComponentType })))
}

const LoginPage = load(() => import('../pages/login-page.tsx'), 'LoginPage')
const ForgotPasswordPage = load(() => import('../pages/forgot-password-page.tsx'), 'ForgotPasswordPage')
const VerifyPage = load(() => import('../pages/verify-page.tsx'), 'VerifyPage')
const NotFoundPage = lazy(() => import('../pages/not-found-page.tsx').then((module) => ({ default: module.NotFoundPage })))
const StudentDashboardPage = load(() => import('../pages/student/dashboard-page.tsx'), 'StudentDashboardPage')
const StudentCoursesPage = load(() => import('../pages/student/courses-page.tsx'), 'StudentCoursesPage')
const CourseDetailPage = load(() => import('../pages/student/course-detail-page.tsx'), 'CourseDetailPage')
const StudentMaterialsPage = load(() => import('../pages/student/materials-page.tsx'), 'StudentMaterialsPage')
const TakeAssessmentPage = load(() => import('../pages/student/assessment-page.tsx'), 'TakeAssessmentPage')
const StudentResultsPage = load(() => import('../pages/student/results-page.tsx'), 'StudentResultsPage')
const StudentCertificatesPage = load(() => import('../pages/student/certificates-page.tsx'), 'StudentCertificatesPage')
const CertificateViewPage = load(() => import('../pages/student/certificate-view-page.tsx'), 'CertificateViewPage')
const StudentAttendancePage = load(() => import('../pages/student/attendance-page.tsx'), 'StudentAttendancePage')
const StudentAnnouncementsPage = load(() => import('../pages/student/announcements-page.tsx'), 'StudentAnnouncementsPage')
const StudentMessagesPage = load(() => import('../pages/student/messages-page.tsx'), 'StudentMessagesPage')
const StudentSupportPage = load(() => import('../pages/student/support-page.tsx'), 'StudentSupportPage')
const StudentInboxPage = load(() => import('../pages/student/inbox-page.tsx'), 'StudentInboxPage')
const ProfilePage = load(() => import('../pages/student/profile-page.tsx'), 'ProfilePage')
const StaffDashboardPage = load(() => import('../pages/staff/dashboard-page.tsx'), 'StaffDashboardPage')
const StudentsPage = load(() => import('../pages/staff/students-page.tsx'), 'StudentsPage')
const StudentProfilePage = load(() => import('../pages/staff/student-profile-page.tsx'), 'StudentProfilePage')
const StudentImportPage = load(() => import('../pages/staff/student-import-page.tsx'), 'StudentImportPage')
const StaffCoursesPage = load(() => import('../pages/staff/courses-page.tsx'), 'StaffCoursesPage')
const EnrolmentsPage = load(() => import('../pages/staff/enrolments-page.tsx'), 'EnrolmentsPage')
const StaffMaterialsPage = load(() => import('../pages/staff/materials-page.tsx'), 'StaffMaterialsPage')
const StaffAssessmentsPage = load(() => import('../pages/staff/assessments-page.tsx'), 'StaffAssessmentsPage')
const AssessmentEditorPage = load(() => import('../pages/staff/assessment-detail-page.tsx'), 'AssessmentEditorPage')
const StaffResultsPage = load(() => import('../pages/staff/results-page.tsx'), 'StaffResultsPage')
const StaffCertificatesPage = load(() => import('../pages/staff/certificates-page.tsx'), 'StaffCertificatesPage')
const StaffCertificateViewPage = load(() => import('../pages/staff/certificate-view-page.tsx'), 'StaffCertificateViewPage')
const StaffAttendancePage = load(() => import('../pages/staff/attendance-page.tsx'), 'StaffAttendancePage')
const StaffAnnouncementsPage = load(() => import('../pages/staff/announcements-page.tsx'), 'StaffAnnouncementsPage')
const AnalyticsPage = load(() => import('../pages/staff/analytics-page.tsx'), 'AnalyticsPage')
const StaffMessagesPage = load(() => import('../pages/staff/messages-page.tsx'), 'StaffMessagesPage')
const StaffEmailPage = load(() => import('../pages/staff/email-page.tsx'), 'StaffEmailPage')
const StaffTicketsPage = load(() => import('../pages/staff/tickets-page.tsx'), 'StaffTicketsPage')
const ReportsPage = load(() => import('../pages/staff/reports-page.tsx'), 'ReportsPage')
const AuditPage = load(() => import('../pages/staff/audit-page.tsx'), 'AuditPage')
const UsersPage = load(() => import('../pages/staff/users-page.tsx'), 'UsersPage')
const SettingsPage = load(() => import('../pages/staff/settings-page.tsx'), 'SettingsPage')

function Root() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted" role="status">Loading the page…</p>}>
      <Outlet />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/verify/:certificateNumber', element: <VerifyPage /> },
      {
        element: <RequireAuth area="student" />,
        children: [
          {
            path: '/app',
            element: <StudentShell />,
            children: [
              { index: true, element: <StudentDashboardPage /> },
              { path: 'courses', element: <StudentCoursesPage /> },
              { path: 'courses/:courseId', element: <CourseDetailPage /> },
              { path: 'courses/:courseId/materials', element: <StudentMaterialsPage /> },
              { path: 'assessments/:assessmentId', element: <TakeAssessmentPage /> },
              { path: 'results', element: <StudentResultsPage /> },
              { path: 'certificates', element: <StudentCertificatesPage /> },
              { path: 'certificates/:certificateId', element: <CertificateViewPage /> },
              { path: 'attendance', element: <StudentAttendancePage /> },
              { path: 'announcements', element: <StudentAnnouncementsPage /> },
              { path: 'messages', element: <StudentMessagesPage /> },
              { path: 'support', element: <StudentSupportPage /> },
              { path: 'inbox', element: <StudentInboxPage /> },
              { path: 'profile', element: <ProfilePage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth area="staff" />,
        children: [
          {
            path: '/staff',
            element: <StaffShell />,
            children: [
              { index: true, element: <StaffDashboardPage /> },
              { path: 'students', element: <StudentsPage /> },
              { path: 'students/import', element: <StudentImportPage /> },
              { path: 'students/:studentId', element: <StudentProfilePage /> },
              { path: 'courses', element: <StaffCoursesPage /> },
              { path: 'enrolments', element: <EnrolmentsPage /> },
              { path: 'materials', element: <StaffMaterialsPage /> },
              { path: 'assessments', element: <StaffAssessmentsPage /> },
              { path: 'assessments/:assessmentId', element: <AssessmentEditorPage /> },
              { path: 'results', element: <StaffResultsPage /> },
              { path: 'certificates', element: <StaffCertificatesPage /> },
              { path: 'certificates/:certificateId', element: <StaffCertificateViewPage /> },
              { path: 'attendance', element: <StaffAttendancePage /> },
              { path: 'announcements', element: <StaffAnnouncementsPage /> },
              { path: 'analytics', element: <AnalyticsPage /> },
              { path: 'messages', element: <StaffMessagesPage /> },
              { path: 'email', element: <StaffEmailPage /> },
              { path: 'tickets', element: <StaffTicketsPage /> },
              { path: 'reports', element: <ReportsPage /> },
              { element: <RequireRoles roles={['super_admin']} />, children: [
                { path: 'users', element: <UsersPage /> },
                { path: 'audit', element: <AuditPage /> },
              ] },
              { element: <RequireRoles roles={['super_admin', 'administrator']} />, children: [
                { path: 'settings', element: <SettingsPage /> },
              ] },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
