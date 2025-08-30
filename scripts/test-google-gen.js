#!/usr/bin/env node
// Simple Google AI Studio image generation test
// Usage: GOOGLE_API_KEY=... node scripts/test-google-gen.js

import fs from 'fs';

// Tiny 1x1 PNG
const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHqwKkz5b1/wAAAABJRU5ErkJggg==';

const key = process.env.GOOGLE_API_KEY;
if (!key) {
  console.error('NO GOOGLE_API_KEY found in environment or .env');
  process.exit(1);
}

const payload = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: 'modern interior, soft daylight, high fidelity' },
        { inlineData: { mimeType: 'image/png', data: tinyPngB64 } }
      ]
    }
  ]
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${encodeURIComponent(key)}`;

try {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(JSON.stringify({ ok: false, status: r.status, error: j.error || j }, null, 2));
    process.exit(0);
  }
  let outMime = 'image/png';
  let outData = '';
  const candidates = j.candidates || [];
  for (const c of candidates) {
    const parts = (c.content && c.content.parts) || c.parts || [];
    for (const p of parts) {
      if (p?.inlineData?.data) {
        outData = p.inlineData.data;
        outMime = p.inlineData.mimeType || outMime;
        break;
      }
    }
    if (outData) break;
  }
  const dataUrl = outData ? `data:${outMime};base64,${outData}` : null;
  console.log(JSON.stringify({ ok: !!dataUrl, hasImage: !!dataUrl, prefix: dataUrl ? dataUrl.slice(0, 60) : null }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e) }, null, 2));
}



