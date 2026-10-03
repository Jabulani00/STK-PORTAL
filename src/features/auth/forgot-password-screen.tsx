import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Field } from '../../components/field.tsx'
import { Logo } from '../../components/logo.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Callout } from '../../components/callout.tsx'
import { usePageTitle } from '../../hooks/use-portal.ts'

const schema = z.object({
  email: z.string().trim().email('Enter the email address on your account.'),
})

export function ForgotPasswordScreen() {
  usePageTitle('Reset password')
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold text-navy">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">We will use this address when email delivery is connected.</p>
      {sent ? (
        <Callout tone="success">
          If an account exists for that email, a reset message would be sent. This prototype does not send email. Use the demo password on the sign-in page.
        </Callout>
      ) : (
        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit(() => {
            setSent(true)
          })}
        >
          <Field label="Email" htmlFor="reset-email" error={form.formState.errors.email?.message}>
            <Input id="reset-email" type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Button type="submit">Request reset</Button>
        </form>
      )}
      <Link className="mt-6 text-sm font-semibold text-navy underline" to="/login">
        Back to sign in
      </Link>
    </div>
  )
}
