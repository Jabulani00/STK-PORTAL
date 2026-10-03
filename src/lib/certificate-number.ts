export function nextCertificateNumber(
  pattern: string,
  code: string,
  year: number,
  existing: string[],
) {
  const prefix = pattern
    .replaceAll('{CODE}', code.toUpperCase())
    .replaceAll('{YEAR}', String(year))
    .replaceAll('{SEQ}', '')

  const next =
    existing.reduce((max, number) => {
      if (!number.startsWith(prefix)) return max
      const suffix = number.slice(prefix.length)
      if (!/^\d+$/.test(suffix)) return max
      return Math.max(max, Number.parseInt(suffix, 10))
    }, 0) + 1

  return `${prefix}${String(next).padStart(6, '0')}`
}
