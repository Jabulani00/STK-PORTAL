import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { userById } from '../services/access.ts'
import { portalStore } from '../services/store.ts'
import { readSession } from '../services/session.ts'

export function useDatabase() {
  return useQuery({
    queryKey: ['database'],
    queryFn: () => portalStore.get(),
    initialData: portalStore.get(),
    staleTime: Infinity,
  }).data
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => readSession(),
    initialData: readSession(),
    staleTime: Infinity,
  }).data
}

export function useCurrentUser() {
  const database = useDatabase()
  const session = useSession()
  if (!session) return null
  const user = userById(database, session.userId)
  if (!user || user.status !== 'active') return null
  return user
}

export function useSyncPortal() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.setQueryData(['database'], portalStore.get())
  }
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · STK College`
  }, [title])
}
