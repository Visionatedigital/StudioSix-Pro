/**
 * Script to disable Supabase email confirmations
 * This will stop the duplicate emails from Supabase
 */

const fetch = require('node-fetch');

const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

console.log('🔧 Attempting to disable Supabase email confirmations...');
console.log('📧 Project URL:', SUPABASE_URL);

// Unfortunately, we cannot disable email confirmations via the client API
// This requires access to the Supabase dashboard or service role key

console.log('❌ Cannot disable email confirmations programmatically with anon key');
console.log('');
console.log('🔧 MANUAL STEPS REQUIRED:');
console.log('1. Go to: https://supabase.com/dashboard');
console.log('2. Select your project: zwrooqvwxdwvnuhpepta');
console.log('3. Go to: Authentication → Settings');
console.log('4. Find: "Enable email confirmations"');
console.log('5. Toggle OFF email confirmations');
console.log('6. Save changes');
console.log('');
console.log('OR alternatively:');
console.log('1. Go to: Authentication → Email Templates');
console.log('2. Disable the confirmation email template');
console.log('');
console.log('This is the ONLY way to stop Supabase from sending confirmation emails.');