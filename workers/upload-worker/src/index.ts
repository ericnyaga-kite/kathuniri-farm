export interface Env {
  BUCKET: R2Bucket
  UPLOAD_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // ── CORS headers ───────────────────────────────────────────────────────
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Secret',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const key = url.pathname.replace(/^\//, '')

    // ── GET /:key — serve file ─────────────────────────────────────────────
    if (request.method === 'GET') {
      if (!key) return new Response('Not found', { status: 404, headers: corsHeaders })
      const obj = await env.BUCKET.get(key)
      if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders })
      const headers = new Headers(corsHeaders)
      headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(obj.body, { headers })
    }

    // ── PUT /:key — upload file ────────────────────────────────────────────
    if (request.method === 'PUT') {
      const secret = request.headers.get('X-Upload-Secret')
      if (secret !== env.UPLOAD_SECRET) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
      }
      if (!key) return new Response('Key required', { status: 400, headers: corsHeaders })

      const contentType = request.headers.get('Content-Type') ?? 'application/octet-stream'
      const body = await request.arrayBuffer()

      await env.BUCKET.put(key, body, {
        httpMetadata: { contentType },
      })

      const publicUrl = `${url.origin}/${key}`
      return new Response(JSON.stringify({ key, url: publicUrl }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── DELETE /:key ───────────────────────────────────────────────────────
    if (request.method === 'DELETE') {
      const secret = request.headers.get('X-Upload-Secret')
      if (secret !== env.UPLOAD_SECRET) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
      }
      if (!key) return new Response('Key required', { status: 400, headers: corsHeaders })
      await env.BUCKET.delete(key)
      return new Response(JSON.stringify({ deleted: key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  },
}
