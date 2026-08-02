import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authorizeMcpRequest } from '@/lib/mcp/auth'
import { registerKpiTools } from '@/lib/mcp/register-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  const unauthorized = authorizeMcpRequest(req)
  if (unauthorized) return unauthorized

  // Fresh server + transport per request (required for SDK 1.26+ stateless HTTP).
  const server = new McpServer({
    name: 'Stepscale KPI Tracker',
    version: '1.0.0',
  })
  registerKpiTools(server)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export { handle as GET, handle as POST, handle as DELETE }
