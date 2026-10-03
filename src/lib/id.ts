export function createId(prefix: string) {
  const value =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
  return `${prefix}-${value.replaceAll('-', '').slice(0, 8)}`
}
