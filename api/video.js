export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const prompt = String((req.body && req.body.prompt) || '').trim();
  if (prompt.length < 10 || prompt.length > 1000)
    return res.status(400).json({ error: 'Prompt 10 se 1000 characters ka hona chahiye' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN set nahi hai' });
  const model = process.env.REPLICATE_MODEL || 'wan-video/wan-2.1-t2v-480p';
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'wait=55' },
      body: JSON.stringify({ input: { prompt } }),
    });
    let p = await r.json();
    if (!r.ok) return res.status(502).json({ error: p.detail || 'Model error' });

    for (let i = 0; i < 20 && !['succeeded', 'failed', 'canceled'].includes(p.status); i++) {
      await new Promise((s) => setTimeout(s, 3000));
      p = await (await fetch(p.urls.get, { headers: auth })).json();
    }
    if (p.status !== 'succeeded')
      return res.status(504).json({ error: 'Video taiyar nahi hua, dobara try karo', status: p.status });

    return res.status(200).json({ url: Array.isArray(p.output) ? p.output[0] : p.output });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
