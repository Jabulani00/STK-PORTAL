import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { portalStore } from '../services/store.ts'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

function SyncStore() {
  useEffect(
    () =>
      portalStore.subscribe(() => {
        queryClient.setQueryData(['database'], portalStore.get())
      }),
    [],
  )
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncStore />
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
