import { PageHeader } from '../../components/page-header.tsx'
import { useCurrentUser, useDatabase, usePageTitle } from '../../hooks/use-portal.ts'
import { formatDateTime, fullName } from '../../lib/format.ts'
import { canViewAudit, userById } from '../../services/access.ts'
import { AccessDenied } from '../../components/access-denied.tsx'

export function AuditScreen() {
  usePageTitle('Audit log')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  if (!canViewAudit(user.role)) return <AccessDenied home="/staff" />
  return (
    <div>
      <PageHeader title="Audit log" description="These entries are read-only. Restoring demo data is the only way this prototype clears them." />
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead className="bg-canvas text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3" scope="col">When</th>
              <th className="px-4 py-3" scope="col">Actor</th>
              <th className="px-4 py-3" scope="col">Action</th>
              <th className="px-4 py-3" scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {database.auditLogs.map((entry) => {
              const actor = userById(database, entry.actorUserId)
              return (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDateTime(entry.timestamp)}</td>
                  <td className="px-4 py-3">{actor ? fullName(actor) : 'Unknown'}</td>
                  <td className="px-4 py-3">{entry.action}</td>
                  <td className="px-4 py-3">{entry.newValue ?? entry.previousValue ?? entry.entityId}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
