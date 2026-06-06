export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const prefix = url.searchParams.get('prefix');

    if (prefix) {
      // 读所有以prefix开头的记录
      const { results } = await db.prepare(
        'SELECT key, value FROM store WHERE key LIKE ?'
      ).bind(prefix + '%').all();
      const data = results.map(r => {
        try { return { key: r.key, value: JSON.parse(r.value) }; }
        catch { return { key: r.key, value: r.value }; }
      });
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (key) {
      const row = await db.prepare('SELECT value FROM store WHERE key = ?').bind(key).first();
      if (!row) return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      try {
        return new Response(row.value, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch {
        return new Response(JSON.stringify(row.value), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'key or prefix required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    const { key, value } = await request.json();
    const ts = Date.now();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await db.prepare(
      'INSERT OR REPLACE INTO store (key, value, updated_at) VALUES (?, ?, ?)'
    ).bind(key, serialized, ts).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}
