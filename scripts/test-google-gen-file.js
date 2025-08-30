#!/usr/bin/env node
// Usage: GOOGLE_API_KEY=... node scripts/test-google-gen-file.js <imagePath> [prompt]

import fs from 'fs';

const [,, imagePath, promptArg] = process.argv;
if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('Provide a valid image path.');
  process.exit(1);
}

const key = process.env.GOOGLE_API_KEY;
if (!key) {
  console.error('NO GOOGLE_API_KEY in env');
  process.exit(1);
}

const mimeType = imagePath.toLowerCase().endsWith('.jpg') || imagePath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
const data = fs.readFileSync(imagePath).toString('base64');

const promptText = promptArg || process.env.PROMPT || 'photorealistic render of this interior sketch, clean lighting, realistic materials, soft daylight, professional architectural visualization';

const payload = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: promptText },
        { inlineData: { mimeType, data } }
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
  if (outData) {
    const ext = outMime.includes('jpeg') ? 'jpg' : 'png';
    fs.writeFileSync(`/tmp/google_gen_output.${ext}`, Buffer.from(outData, 'base64'));
  }
  console.log(JSON.stringify({ ok: !!dataUrl, hasImage: !!dataUrl, prefix: dataUrl ? dataUrl.slice(0, 60) : null, saved: outData ? true : false }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e) }, null, 2));
}


