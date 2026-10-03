import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ConfirmDialog } from '../../components/confirm-dialog.tsx'
import { Field } from '../../components/field.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { roleLabels } from '../../lib/labels.ts'
import { studentNumberOf } from '../../services/access.ts'
import { resetDemoData, updateOwnPhone } from '../../services/api.ts'
import { sampleDataEnabled } from '../../services/store.ts'

const schema = z.object({
  phone: z.string().trim().min(7, 'Enter a valid phone number.'),
})

export function ProfileScreen() {
  usePageTitle('Profile')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [resetOpen, setResetOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: user ? { phone: user.phone } : undefined,
  })
  if (!user) return null
  const studentNumber = user.role === 'student' ? studentNumberOf(database, user.id) : ''

  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" description="You can update your phone number. Email changes are made by the college office." />
      <dl className="mb-6 grid gap-2 text-sm">
        <div><dt className="text-muted">Name</dt><dd className="font-semibold">{user.firstName} {user.lastName}</dd></div>
        <div><dt className="text-muted">Email</dt><dd className="font-semibold">{user.email}</dd></div>
        <div><dt className="text-muted">Role</dt><dd className="font-semibold">{roleLabels[user.role]}</dd></div>
        {studentNumber ? <div><dt className="text-muted">Student number</dt><dd className="font-semibold">{studentNumber}</dd></div> : null}
      </dl>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => {
        try {
          updateOwnPhone(user.id, values.phone)
          sync()
          toast.success('Phone number saved.')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The phone number could not be saved.')
        }
      })}>
        <Field label="Phone" htmlFor="profile-phone" error={form.formState.errors.phone?.message}>
          <Input id="profile-phone" {...form.register('phone')} />
        </Field>
        <Button type="submit">Save phone number</Button>
      </form>
      {sampleDataEnabled() ? (
        <div className="mt-8">
          <Button variant="outline" onClick={() => setResetOpen(true)}>Restore demo data</Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restore demo data?"
        description="This replaces records saved in this browser with the original sample college."
        confirmLabel="Restore"
        tone="danger"
        onConfirm={() => {
          try {
            resetDemoData()
            sync()
            setResetOpen(false)
            toast.success('Demo data restored.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Demo data was not restored.')
          }
        }}
      />
    </div>
  )
}
