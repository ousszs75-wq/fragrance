// Vercel serverless function: stocke les données du site (Upstash Redis via Vercel Marketplace)
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CODE = process.env.ADMIN_CODE || 'Aminefrag31';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const r = await fetch(U + '/get/store', { headers: { Authorization: 'Bearer ' + T } });
      const j = await r.json();
      return res.status(200).json(j.result ? JSON.parse(j.result) : {});
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (b.code !== CODE) return res.status(401).json({ error: 'bad code' });
      if (b.data) {
        await fetch(U + '/set/store', { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(b.data) });
      }
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: String(e) }); }
};
