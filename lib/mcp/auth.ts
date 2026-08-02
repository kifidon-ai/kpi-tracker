import { timingSafeEqual } from 'crypto'

export function authorizeMcpRequest(req: Request): Response | null {
  const expected = (process.env.KPI_MCP_API_KEY || '').trim()
  const header = req.headers.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  const candidate = scheme?.toLowerCase() === 'bearer' ? (token || '').trim() : ''

  if (!expected || !bearerMatches(candidate, expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer',
        'cache-control': 'no-store',
      },
    })
  }
  return null
}

function bearerMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
