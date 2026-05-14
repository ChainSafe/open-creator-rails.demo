const FALLBACK = '—'

/** Indexer / on-chain times are Unix seconds (bigint or number). */
export function formatUnixSecondsReadable(value: bigint | number | undefined | null): string {
  if (value == null) return FALLBACK
  const sec = typeof value === 'bigint' ? value : BigInt(value)
  const ms = Number(sec) * 1000
  if (!Number.isFinite(ms)) return sec.toString()
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return sec.toString()
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
