#!/usr/bin/env node
// Reset monthly render usage for a user (local storage profile fallback)

import fs from 'fs';

const email = process.argv[2] || 'cmero177@gmail.com';

// In this app, SubscriptionService stores subscription under localStorage.
// For a CLI workaround, we write a small script that, when executed in the browser console,
// would clear usage. Since we are in Node, we can emit instructions or, if a database existed,
// we'd call its API. For now, we create a helper snippet to paste in DevTools.

const snippet = `(() => {
  try {
    const keyPrefix = 'studiosix_subscription_';
    const keys = Object.keys(localStorage).filter(k => k.startsWith(keyPrefix));
    for (const k of keys) {
      try {
        const sub = JSON.parse(localStorage.getItem(k));
        if (!sub) continue;
        // Match by email if present in storage key or subscription userId equals email
        if (k.includes('${email}') || sub.userId === '${email}') {
          sub.usage = sub.usage || {};
          sub.usage.imageRendersThisMonth = 0;
          sub.usage.aiTokensThisMonth = sub.usage.aiTokensThisMonth || 0;
          sub.usage.lastResetDate = new Date().toDateString();
          localStorage.setItem(k, JSON.stringify(sub));
          console.log('✅ Reset renders for', k, sub);
        }
      } catch {}
    }
  } catch (e) { console.error(e); }
})()`;

console.log('\nPaste the following into the browser DevTools console on the app domain to reset usage for', email, ':\n');
console.log(snippet);
console.log('\n');



