import { localIsoDate } from './format.ts'

export function assessmentWindow(
  assessment: { availableFrom: string; availableUntil: string },
  today = localIsoDate(),
) {
  if (today < assessment.availableFrom) return 'upcoming' as const
  if (today > assessment.availableUntil) return 'closed' as const
  return 'open' as const
}
