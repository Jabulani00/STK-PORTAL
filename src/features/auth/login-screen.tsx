import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Logo } from '../../components/logo.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Field } from '../../components/field.tsx'
import { useCurrentUser, usePageTitle } from '../../hooks/use-portal.ts'
import { DEMO_PASSWORD, isStaffRole } from '../../services/access.ts'
import { authenticate } from '../../services/api.ts'
import { writeSession } from '../../services/session.ts'

const schema = z.object({
  email: z.string().trim().email('Enter the email address on your account.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
})

type LoginValues = z.infer<typeof schema>

const demos = [
  { email: 'lerato.khumalo@stkcollege.org', label: 'Student', name: 'Lerato Khumalo' },
  { email: 'nomsa.dlamini@stkcollege.org', label: 'Student', name: 'Nomsa Dlamini' },
  { email: 'ayesha.patel@stkcollege.org', label: 'Facilitator', name: 'Ayesha Patel' },
  { email: 'sipho.ndlovu@stkcollege.org', label: 'Administrator', name: 'Sipho Ndlovu' },
  { email: 'thandi.mokoena@stkcollege.org', label: 'Super Admin', name: 'Thandi Mokoena' },
]

export function LoginScreen() {
  usePageTitle('Sign in')
  const user = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: true },
  })

  if (user) return <Navigate to={user.role === 'student' ? '/app' : '/staff'} replace />

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-navy px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tone="light" />
        <div>
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">STK College</p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight">Building skills. Creating opportunities. Transforming futures.</h1>
          <p className="mt-4 max-w-md text-white/75">
            A portal for enrolled learners and the staff who teach them. Courses, materials, assessments, results and certificates stay with the right account.
          </p>
        </div>
        <p className="text-sm text-white/60">Prototype sign-in uses demo accounts stored in this browser.</p>
      </section>
      <section className="flex items-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold text-navy">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your college email and password.</p>
          <form
            className="mt-6 grid gap-4"
            onSubmit={form.handleSubmit((values) => {
              try {
                const account = authenticate(values.email, values.password)
                writeSession(account.id, values.remember)
                queryClient.setQueryData(['session'], { userId: account.id })
                const from = (location.state as { from?: string } | null)?.from
                const staff = isStaffRole(account.role)
                if (staff) navigate(from?.startsWith('/staff') ? from : '/staff')
                else navigate(from?.startsWith('/app') ? from : '/app')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Sign-in failed.')
              }
            })}
          >
            <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(form.formState.errors.password)}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" {...form.register('remember')} />
              Remember this session on this device
            </label>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-sm">
            <Link className="font-semibold text-navy underline" to="/forgot-password">
              Forgot password
            </Link>
          </p>
          <div className="mt-8 rounded-lg border border-line bg-white p-4">
            <p className="text-sm font-semibold text-navy">Demo accounts</p>
            <p className="mt-1 text-sm text-muted">
              Password for every demo account: <span className="font-semibold text-ink">{DEMO_PASSWORD}</span>
            </p>
            <div className="mt-3 grid gap-2">
              {demos.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-canvas"
                  onClick={() => {
                    form.setValue('email', demo.email)
                    form.setValue('password', DEMO_PASSWORD)
                  }}
                >
                  <span className="font-semibold text-navy">{demo.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {demo.label} · {demo.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
