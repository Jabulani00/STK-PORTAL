import { toast } from 'sonner'
import { AccessDenied } from '../../components/access-denied.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { roleLabels } from '../../lib/labels.ts'
import { canManageSettings, canManageUsers } from '../../services/access.ts'
import { setAccountStatus, setStaffRole } from '../../services/api.ts'
import { fullName } from '../../lib/format.ts'
import type { Role } from '../../types/index.ts'

const staffRoles: Role[] = ['super_admin', 'administrator', 'facilitator']

export function UsersScreen() {
  usePageTitle('Users and roles')
  const actor = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  if (!actor) return null
  if (!canManageUsers(actor.role)) return <AccessDenied home="/staff" />
  const people = database.users.filter((user) => user.role !== 'student')
  return (
    <div className="grid gap-6">
      <PageHeader title="Users and roles" description="Staff roles decide what a person can open. Students stay on student accounts." />
      <div className="grid gap-3">
        {database.roles.map((role) => (
          <article key={role.id} className="rounded-lg border border-line bg-white p-4">
            <h2 className="font-semibold text-navy">{role.name}</h2>
            <p className="mt-1 text-sm text-muted">{role.summary}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {role.permissions.map((permission) => <li key={permission}>{permission}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Staff accounts</caption>
          <thead className="bg-canvas text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3" scope="col">Name</th>
              <th className="px-4 py-3" scope="col">Role</th>
              <th className="px-4 py-3" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-t border-line">
                <td className="px-4 py-3">{fullName(person)}<span className="block text-xs text-muted">{person.email}</span></td>
                <td className="px-4 py-3">
                  <select aria-label={`Role for ${fullName(person)}`} className="h-10 rounded-md border border-line px-2" value={person.role} disabled={person.id === actor.id} onChange={(event) => {
                    try {
                      setStaffRole(actor.id, person.id, event.target.value as Role)
                      sync()
                      toast.success('Role updated.')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'The role could not be changed.')
                    }
                  }}>
                    {staffRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" disabled={person.id === actor.id} onClick={() => {
                    try {
                      setAccountStatus(actor.id, person.id, person.status === 'active' ? 'inactive' : 'active')
                      sync()
                      toast.success('Account updated.')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'The account could not be updated.')
                    }
                  }}>{person.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  usePageTitle('Settings')
  const user = useCurrentUser()
  const database = useDatabase()
  if (!user) return null
  if (!canManageSettings(user.role)) return <AccessDenied home="/staff" />
  return (
    <div>
      <PageHeader title="Settings" description="Pass marks and assessment weights are edited on the Results page so a change recalculates stored course results." />
      <p className="text-sm text-muted">Certificate numbers use each course pattern, currently STK-{'{CODE}'}-{'{YEAR}'}-{'{SEQ}'}, for {database.settings.certificateYear}. Upload limit: {database.settings.maxUploadMb} MB.</p>
      <p className="mt-3 text-sm">Signed in as {fullName(user)}.</p>
    </div>
  )
}
