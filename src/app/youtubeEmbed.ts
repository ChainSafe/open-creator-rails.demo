/** Returns a YouTube embed URL for watch/youtu.be links, or null if not parseable. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/)
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`
    }
  } catch {
    return null
  }
  return null
}
