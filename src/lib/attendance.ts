import type { AttendanceRecord } from '../types/index.ts'

export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  excused: number
  percentage: number | null
}

export function attendanceSummary(records: AttendanceRecord[]): AttendanceSummary {
  const present = records.filter((record) => record.status === 'present').length
  const absent = records.filter((record) => record.status === 'absent').length
  const late = records.filter((record) => record.status === 'late').length
  const excused = records.filter((record) => record.status === 'excused').length
  const counted = present + absent + late
  return {
    present,
    absent,
    late,
    excused,
    percentage: counted === 0 ? null : Math.round(((present + late) / counted) * 100),
  }
}
