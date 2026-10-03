export interface WeightedScore {
  assessmentId: string
  weight: number
  percentage: number | null
}

export interface CourseScore {
  percentage: number | null
  complete: boolean
  status: 'in_progress' | 'pass' | 'fail'
}

export function calculateCourseScore(items: WeightedScore[], passMark: number): CourseScore {
  if (items.length === 0 || items.some((item) => item.percentage === null)) {
    return { percentage: null, complete: false, status: 'in_progress' }
  }

  const weightTotal = items.reduce((sum, item) => sum + item.weight, 0)
  if (weightTotal <= 0) {
    return { percentage: null, complete: false, status: 'in_progress' }
  }

  const raw = items.reduce((sum, item) => sum + ((item.percentage ?? 0) * item.weight) / weightTotal, 0)
  const percentage = Math.round(raw)
  return {
    percentage,
    complete: true,
    status: percentage >= passMark ? 'pass' : 'fail',
  }
}
