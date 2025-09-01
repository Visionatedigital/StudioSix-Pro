#!/usr/bin/env node

/*
 * Send StudioSix Launch Email (Preview or Broadcast)
 * - Uses RESEND_API_KEY from environment
 * - Preview: send to a single email
 * - Broadcast: (future) send to a Resend Audience by name
 */

const fs = require('fs');
const path = require('path');
// Load environment variables from .env if present
try { require('dotenv').config(); } catch (e) {}

// Use global fetch (Node 18+) or lazy-load node-fetch
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) => import('node-fetch').then(mod => mod.default(...args));
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.REACT_APP_RESEND_API_KEY;

const DEFAULT_FROM = 'StudioSix Pro <onboarding@studiosix.ai>';
const DEFAULT_SUBJECT = "It’s Official — StudioSix is Live! Join our Launch Webinar";
const MEET_LINK = 'https://meet.google.com/juy-szoi-bsb';
const EVENT_TITLE = 'StudioSix Demo';
const EVENT_LOCATION = 'Google Meet';
const EVENT_TIME = 'Monday, September 1 · 7:00 – 8:00pm';
const EVENT_TZ = 'East Africa/EAT';

// Absolute path to the poster image provided by the user
const POSTER_ABS_PATH = '/Users/mark/StudioSix-Pro-Clean/public/Launchday Banner/IMG_9030.png';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { to: 'visionatedigital@gmail.com', audience: null, preview: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--to' || a === '-t') && args[i + 1]) {
      out.to = args[++i];
    } else if ((a === '--audience' || a === '-a') && args[i + 1]) {
      out.audience = args[++i];
      out.preview = false;
    } else if (a === '--from' && args[i + 1]) {
      out.from = args[++i];
    } else if (a === '--subject' && args[i + 1]) {
      out.subject = args[++i];
    }
  }
  return out;
}

function safeReadPosterBase64() {
  try {
    if (fs.existsSync(POSTER_ABS_PATH)) {
      const img = fs.readFileSync(POSTER_ABS_PATH);
      const b64 = img.toString('base64');
      return b64;
    }
  } catch (err) {
    console.warn('Warning: failed to read poster image:', err.message);
  }
  return null;
}

function buildEmailHtml({ useCidImage }) {
  const bodyCopy = `
  ✨ It’s Official — StudioSix is Live! ✨<br/>
  Today we open the doors to the future of design.<br/><br/>
  StudioSix is our AI-powered BIM platform built to supercharge Designers with smarter, faster workflows.<br/><br/>
  We’re inviting you to join us for our Launch Webinar 🎥 where we’ll showcase how StudioSix transforms the way you design, model, and render.<br/><br/>
  <a href="${MEET_LINK}" style="color:#fff; text-decoration:none;">Join the Webinar 👉 ${MEET_LINK}</a><br/><br/>
  <strong>Event:</strong> ${EVENT_TITLE}<br/>
  <strong>Location:</strong> ${EVENT_LOCATION}<br/>
  <strong>${EVENT_TIME}</strong><br/>
  <strong>Time zone:</strong> ${EVENT_TZ}<br/><br/>
  Come see why we believe StudioSix isn’t just another tool, but the next step in the evolution of design technology.<br/><br/>
  The Future of Design is here🚀
  `;

  const preheader = 'StudioSix is live — join our launch webinar!';

  const imageTag = useCidImage
    ? '<img src="cid:launch-banner" alt="StudioSix Launch" style="width:100%; display:block; max-height:480px; object-fit:cover;"/>'
    : '';

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>StudioSix Launch</title>
      <style>
        .btn { display:inline-block; padding:14px 22px; border-radius:10px; background:#8b5cf6; color:#fff !important; text-decoration:none; font-weight:600; }
        .container { max-width:640px; margin:0 auto; background:rgba(15,23,42,0.9); border:1px solid rgba(148,163,184,0.2); border-radius:16px; overflow:hidden; }
        .content { padding:32px; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
        .h1 { margin:0; font-size:28px; color:#fff; }
        .muted { color:#94a3b8; }
      </style>
    </head>
    <body style="margin:0; padding:0; background:linear-gradient(135deg,#0f172a 0%,#111827 100%);">
      <div style="display:none; opacity:0; height:0; width:0; overflow:hidden;">${preheader}</div>
      <div class="container">
        ${imageTag}
        <div class="content">
          <h1 class="h1">It’s Official — StudioSix is Live!</h1>
          <p class="muted" style="margin-top:8px;">Join us for the launch webinar and see what’s new.</p>
          <div style="height:16px"></div>
          <div style="font-size:16px; line-height:1.6;">${bodyCopy}</div>
          <div style="height:24px"></div>
          <a href="${MEET_LINK}" class="btn">Join the Webinar</a>
          <div style="height:24px"></div>
          <p class="muted" style="font-size:12px;">© ${new Date().getFullYear()} StudioSix Pro</p>
        </div>
      </div>
    </body>
  </html>`;
}

function buildTextVersion() {
  return (
    'It’s Official — StudioSix is Live!\n' +
    'Today we open the doors to the future of design.\n\n' +
    'StudioSix is our AI-powered BIM platform built to supercharge Designers with smarter, faster workflows.\n\n' +
    'Join the Launch Webinar: ' + MEET_LINK + '\n' +
    `Event: ${EVENT_TITLE}\n` +
    `Location: ${EVENT_LOCATION}\n` +
    `${EVENT_TIME}\n` +
    `Time zone: ${EVENT_TZ}\n\n` +
    'The Future of Design is here.'
  );
}

async function sendEmail({ to, from, subject, html, text, attachments }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in the environment. Export it and retry.');
  }

  const payload = { from, to: Array.isArray(to) ? to : [to], subject, html, text };
  if (attachments && attachments.length) payload.attachments = attachments;

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const textResp = await resp.text();
      let data;
      try { data = JSON.parse(textResp); } catch (e) { data = { raw: textResp }; }
      if (!resp.ok) {
        const msg = (data && (data.message || data.error)) || 'Unknown error';
        throw new Error(`Resend error ${resp.status}: ${msg}`);
      }
      return data;
    } catch (e) {
      lastErr = e;
      // 408/429/5xx retry with backoff
      const retryable = /\b(408|429|5\d\d)\b/.test(String(e.message));
      if (attempt < 3 && retryable) {
        const delayMs = 500 * attempt;
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

async function fetchJson(url) {
  const resp = await fetchFn(url, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && (data.message || data.error)) || 'Unknown error';
    throw new Error(`Resend error ${resp.status}: ${msg}`);
  }
  return data;
}

async function getAudienceByName(audienceName) {
  const list = await fetchJson('https://api.resend.com/audiences');
  const audiences = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
  return audiences.find(a => (a.name || a?.attributes?.name) === audienceName);
}

async function getContactsByAudienceId(audienceId) {
  // Basic list without pagination for now; extend if needed
  const list = await fetchJson(`https://api.resend.com/audiences/${audienceId}/contacts`);
  const contacts = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
  return contacts;
}

async function main() {
  const args = parseArgs();
  const toEmail = args.to;
  const from = args.from || DEFAULT_FROM;
  const subject = args.subject || DEFAULT_SUBJECT;

  const posterB64 = safeReadPosterBase64();
  const html = buildEmailHtml({ useCidImage: !!posterB64 });
  const text = buildTextVersion();
  const attachments = posterB64
    ? [{ filename: path.basename(POSTER_ABS_PATH), content: posterB64, content_id: 'launch-banner', contentType: 'image/png' }]
    : undefined;

  if (args.preview) {
    console.log('Sending preview to:', toEmail);
    const result = await sendEmail({ to: toEmail, from, subject, html, text, attachments });
    console.log('Preview sent. Message ID:', result.id || result.data?.id || 'unknown');
    return;
  }

  if (args.audience) {
    const targetAudienceName = args.audience || 'General';
    console.log('Preparing broadcast to audience:', targetAudienceName);
    const audience = await getAudienceByName(targetAudienceName);
    if (!audience) {
      throw new Error(`Audience "${targetAudienceName}" not found`);
    }
    const audienceId = audience.id || audience?.data?.id;
    if (!audienceId) {
      throw new Error('Audience id not found on audience object');
    }
    const contacts = await getContactsByAudienceId(audienceId);
    const emails = contacts
      .map(c => c.email || c?.attributes?.email)
      .filter(Boolean);
    console.log(`Found ${emails.length} contacts in audience "${targetAudienceName}"`);

    // Throttle sends (concurrency 5)
    const concurrency = 5;
    let index = 0;
    async function worker() {
      while (index < emails.length) {
        const i = index++;
        const recipient = emails[i];
        try {
          await sendEmail({ to: recipient, from, subject, html, text, attachments });
          console.log(`Sent to ${recipient}`);
        } catch (e) {
          console.error(`Failed to send to ${recipient}:`, e.message);
        }
      }
    }
    await Promise.all([...Array(Math.min(concurrency, emails.length))].map(() => worker()));
    console.log('Broadcast complete.');
    return;
  }
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exitCode = 1;
});


