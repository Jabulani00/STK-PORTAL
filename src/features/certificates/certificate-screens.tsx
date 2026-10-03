import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AccessDenied } from '../../components/access-denied.tsx'
import { ImportWizard } from '../../components/import-wizard.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { CERTIFICATE_IMPORT_COLUMNS, validateCertificateImport } from '../../lib/csv.ts'
import { formatDate, fullName } from '../../lib/format.ts'
import {
  canAccessCourse,
  certificateEligibility,
  courseById,
  findPublicCertificate,
  studentNumberOf,
  userById,
  visibleCertificates,
  visibleCourses,
} from '../../services/access.ts'
import { importCertificates, issueCertificate, revokeCertificate } from '../../services/api.ts'
import { ConfirmDialog } from '../../components/confirm-dialog.tsx'

export function StudentCertificates() {
  usePageTitle('Certificates')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  const certificates = visibleCertificates(database, user)
  return (
    <div>
      <PageHeader title="Certificates" description="Download a certificate or check its verification number." />
      <div className="grid gap-3">
        {certificates.length === 0 ? <p className="text-sm text-muted">No certificates have been issued to you yet.</p> : null}
        {certificates.map((certificate) => (
          <div key={certificate.id} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone={certificate.status === 'valid' ? 'success' : 'danger'}>{certificate.status}</Badge>
              <h2 className="mt-2 font-semibold text-navy">{certificate.courseName}</h2>
              <p className="text-sm text-muted">{certificate.certificateNumber} · {formatDate(certificate.completionDate)}</p>
            </div>
            <Link className="text-sm font-semibold text-navy underline" to={`/app/certificates/${certificate.id}`}>View</Link>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CertificateDocument() {
  const { certificateId = '' } = useParams()
  const user = useCurrentUser()
  const database = useDatabase()
  const certificate = database.certificates.find((item) => item.id === certificateId)
  const template = certificate ? database.certificateTemplates.find((item) => item.id === certificate.templateId) : null
  usePageTitle(certificate?.certificateNumber ?? 'Certificate')
  if (!user || !certificate) return <AccessDenied home={user?.role === 'student' ? '/app' : '/staff'} />
  const allowed = user.role === 'student' ? certificate.studentUserId === user.id : canAccessCourse(database, user, certificate.courseId)
  if (!allowed) return <AccessDenied home={user.role === 'student' ? '/app' : '/staff'} />
  const verifyUrl = `${window.location.origin}/verify/${certificate.certificateNumber}`
  const revoked = certificate.status === 'revoked'
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Print this page to save a PDF. The college seal and verification code are part of the document.</p>
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <div className="overflow-x-auto pb-2">
        <article className="certificate-sheet relative mx-auto w-full max-w-5xl bg-[#fbf7ef] text-navy shadow-[0_18px_50px_rgba(15,43,91,0.12)]">
          <div className="pointer-events-none absolute inset-3 border-[3px] border-navy" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-[18px] border border-[#c49612]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-[22px] border border-[#f4c542]/80" aria-hidden="true" />
          <Corner className="top-6 left-6" />
          <Corner className="top-6 right-6 rotate-90" />
          <Corner className="bottom-6 left-6 -rotate-90" />
          <Corner className="right-6 bottom-6 rotate-180" />
          {revoked ? (
            <p className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-danger px-6 py-2 font-display text-5xl font-semibold tracking-[0.2em] text-danger/80 uppercase">
              Revoked
            </p>
          ) : null}

          <div className="relative px-8 py-8 sm:px-12 sm:py-10">
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-xs tracking-[0.32em] text-gold-dark uppercase sm:text-sm">STK College</p>
                <h1 className="font-display mt-1 text-4xl leading-none font-semibold text-navy sm:text-5xl">
                  Certificate
                </h1>
                <p className="font-display text-base tracking-[0.22em] text-navy/80 uppercase sm:text-lg">of completion</p>
              </div>
              <Seal />
            </header>

            <div className="mx-auto mt-6 max-w-2xl text-center">
              <p className="text-xs tracking-[0.22em] text-muted uppercase sm:text-sm">This is to certify that</p>
              <p className="font-display mt-2 text-4xl leading-tight font-medium text-navy italic sm:text-6xl">{certificate.studentName}</p>
              <div className="mx-auto mt-3 h-px w-48 bg-gradient-to-r from-transparent via-gold-dark to-transparent" />
              <p className="mt-4 text-sm tracking-wide text-ink">has successfully completed</p>
              <p className="font-display mt-1 text-2xl font-semibold text-navy sm:text-4xl">{certificate.courseName}</p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
                and has met the academic requirements of this course.
              </p>
            </div>

            <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-4 border-y border-[#e4d7b0] py-4 text-center">
              <div>
                <dt className="text-[11px] tracking-[0.2em] text-muted uppercase">Course</dt>
                <dd className="font-display mt-1 text-xl font-semibold">{certificate.courseCode}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-[0.2em] text-muted uppercase">Result</dt>
                <dd className="font-display mt-1 text-xl font-semibold">{certificate.result}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-[0.2em] text-muted uppercase">Completed</dt>
                <dd className="font-display mt-1 text-xl font-semibold">{formatDate(certificate.completionDate)}</dd>
              </div>
            </dl>

            <footer className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1fr)] md:items-end">
              <div>
                <p className="font-script text-4xl leading-none text-navy">{template?.signatory ?? 'STK College'}</p>
                <div className="mt-1 h-px w-44 bg-navy" />
                <p className="mt-1 text-sm font-semibold text-navy">{template?.signatory ?? 'STK College'}</p>
                <p className="text-xs tracking-wide text-muted uppercase">{template?.signatoryTitle ?? 'STK College'}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Certificate number</p>
                <p className="mt-1 font-semibold tracking-wide text-navy">{certificate.certificateNumber}</p>
                {revoked ? <p className="mt-2 text-sm font-semibold text-danger">Status: Revoked</p> : <p className="mt-2 text-sm font-semibold text-success">Status: Valid</p>}
              </div>
              <div className="flex items-center justify-end gap-3">
                <div className="text-right">
                  <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Scan to verify</p>
                  <p className="mt-1 max-w-36 text-xs leading-snug text-muted">Confirm this certificate on the STK College portal.</p>
                </div>
                <div className="rounded-sm border border-[#e4d7b0] bg-white p-1.5">
                  <QRCodeSVG value={verifyUrl} size={84} bgColor="#ffffff" fgColor="#0F2B5B" aria-label={`Verification code for ${certificate.certificateNumber}`} />
                </div>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </div>
  )
}

function Corner({ className }: { className: string }) {
  return (
    <svg className={`pointer-events-none absolute h-10 w-10 text-gold-dark ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M2 34 V6 H30" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 28 V12 H24" fill="none" stroke="#0F2B5B" strokeWidth="0.8" />
    </svg>
  )
}

function Seal() {
  return (
    <svg className="h-24 w-24 shrink-0" viewBox="0 0 120 120" role="img" aria-label="STK College seal">
      <circle cx="60" cy="60" r="56" fill="#0F2B5B" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="#F4C542" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#F4C542" strokeWidth="0.5" />
      <path id="seal-ring" d="M26,66 A36,36 0 0,1 94,66" fill="none" />
      <text fill="#F4C542" fontSize="8" letterSpacing="2.4" fontFamily="Source Sans 3, sans-serif">
        <textPath href="#seal-ring" startOffset="50%" textAnchor="middle">STK COLLEGE</textPath>
      </text>
      <text x="60" y="68" textAnchor="middle" fill="#F4C542" fontSize="26" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="600">
        STK
      </text>
    </svg>
  )
}

export function StaffCertificates() {
  usePageTitle('Certificates')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [courseId, setCourseId] = useState('')
  const [revokeId, setRevokeId] = useState<string | null>(null)
  if (!user) return null
  const courses = visibleCourses(database, user)
  const selected = courseId || courses[0]?.id || ''
  const course = courseById(database, selected)
  const learners = database.enrolments.filter((enrolment) => enrolment.courseId === selected)
  const certificates = visibleCertificates(database, user).filter((certificate) => certificate.courseId === selected)

  return (
    <div>
      <PageHeader title="Certificates" description="Issue a certificate when the course result is a pass, or import historical certificates." />
      <Tabs defaultValue="issue">
        <TabsList>
          <TabsTrigger value="issue">Issue</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>
        <TabsContent value="issue" className="grid gap-4">
          <label className="grid max-w-sm gap-1 text-sm font-semibold" htmlFor="cert-course">
            Course
            <select id="cert-course" className="h-11 rounded-md border border-line px-3 font-normal" value={selected} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Certificate eligibility</caption>
              <thead className="bg-canvas text-xs text-muted uppercase">
                <tr>
                  <th className="px-4 py-3" scope="col">Student</th>
                  <th className="px-4 py-3" scope="col">Eligibility</th>
                  <th className="px-4 py-3" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((enrolment) => {
                  const student = userById(database, enrolment.studentUserId)
                  const decision = certificateEligibility(database, enrolment.studentUserId, selected)
                  if (!student) return null
                  return (
                    <tr key={enrolment.id} className="border-t border-line">
                      <td className="px-4 py-3">{fullName(student)} · {studentNumberOf(database, student.id)}</td>
                      <td className="px-4 py-3">{decision.reason}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" disabled={!decision.ok} onClick={() => {
                          try {
                            issueCertificate(user.id, student.id, selected)
                            sync()
                            toast.success('Certificate issued.')
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : 'The certificate could not be issued.')
                          }
                        }}>Issue</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2">
            {certificates.map((certificate) => (
              <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                <span>{certificate.certificateNumber} · {certificate.studentName} · {certificate.status}</span>
                <span className="flex gap-2">
                  <Link className="font-semibold text-navy underline" to={`/staff/certificates/${certificate.id}`}>View</Link>
                  {certificate.status === 'valid' ? <Button size="sm" variant="outline" onClick={() => setRevokeId(certificate.id)}>Revoke</Button> : null}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="import">
          <ImportWizard
            templateHref="/templates/certificates-import-template.csv"
            templateFilename="certificates-import-template.csv"
            templateColumns={CERTIFICATE_IMPORT_COLUMNS}
            onParse={(csv) => parseCertificateCsv(csv, database, courses)}
            onConfirm={(csv) => {
              const preview = validateCertificateImport(csv, certificateContext(database, courses))
              try {
                const count = importCertificates(user.id, preview.rows)
                sync()
                return count
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'The import did not finish.')
                return 0
              }
            }}
          />
        </TabsContent>
      </Tabs>
      <p className="mt-4 text-sm text-muted">{course ? `${course.name} uses ${course.certificatePattern}.` : null}</p>
      <ConfirmDialog
        open={Boolean(revokeId)}
        onOpenChange={(open) => { if (!open) setRevokeId(null) }}
        title="Revoke this certificate?"
        description="The number stays on record and the public verification page will show Revoked."
        confirmLabel="Revoke"
        tone="danger"
        onConfirm={() => {
          if (!revokeId) return
          try {
            revokeCertificate(user.id, revokeId)
            sync()
            setRevokeId(null)
            toast.success('Certificate revoked.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The certificate could not be revoked.')
          }
        }}
      />
    </div>
  )
}

function certificateContext(database: ReturnType<typeof useDatabase>, courses: ReturnType<typeof visibleCourses>) {
  return {
    students: database.studentProfiles.flatMap((profile) => {
      const student = userById(database, profile.userId)
      return student ? [{ userId: student.id, studentNumber: profile.studentNumber, name: fullName(student) }] : []
    }),
    courses: courses.map((course) => ({ id: course.id, code: course.code, name: course.name })),
    certificateNumbers: database.certificates.map((certificate) => certificate.certificateNumber),
  }
}

function parseCertificateCsv(csv: string, database: ReturnType<typeof useDatabase>, courses: ReturnType<typeof visibleCourses>) {
  const preview = validateCertificateImport(csv, certificateContext(database, courses))
  return {
    headerError: preview.headerError,
    rows: preview.rows.map((row) => ({
      rowNumber: row.rowNumber,
      label: `${row.studentNumber} ${row.course} ${row.certificateNumber || 'number will be generated'}`,
      errors: row.errors,
    })),
  }
}

export function VerifyScreen() {
  const { certificateNumber = '' } = useParams()
  const database = useDatabase()
  const record = findPublicCertificate(database, decodeURIComponent(certificateNumber))
  usePageTitle('Verify certificate')
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-gold-dark uppercase">STK College</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">
        {record ? (record.status === 'valid' ? 'Certificate verified' : 'Certificate revoked') : 'Certificate not found'}
      </h1>
      {record ? (
        <dl className="mt-6 grid gap-3 rounded-lg border border-line bg-white p-5 text-sm">
          <div><dt className="text-muted">Certificate number</dt><dd className="font-semibold">{record.certificateNumber}</dd></div>
          <div><dt className="text-muted">Student</dt><dd className="font-semibold">{record.studentName}</dd></div>
          <div><dt className="text-muted">Course</dt><dd className="font-semibold">{record.courseName}</dd></div>
          <div><dt className="text-muted">Completion date</dt><dd className="font-semibold">{formatDate(record.completionDate)}</dd></div>
          <div><dt className="text-muted">Status</dt><dd className="font-semibold">{record.status === 'valid' ? 'Valid' : 'Revoked'}</dd></div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted">Check the number and try again. This page does not show contact details or assessment answers.</p>
      )}
      {record?.status === 'revoked' ? <p className="mt-4 font-semibold text-danger">Certificate status: Revoked</p> : null}
    </div>
  )
}
