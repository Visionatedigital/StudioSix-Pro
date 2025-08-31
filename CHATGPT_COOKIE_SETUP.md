# 🍪 ChatGPT Cookie Manager

This script helps you manage ChatGPT login cookies for the AI render system, so you don't have to log in manually every time.

## 🚀 Quick Start

### First Time Setup
```bash
npm run chatgpt-cookies
```

This will:
1. Open a browser window to ChatGPT
2. Wait for you to log in manually
3. Save your login cookies automatically
4. Test that the cookies work

### When Cookies Expire
When you get "login required" errors in the AI render system, just run the same command again:

```bash
npm run chatgpt-cookies
```

## 📋 Usage Instructions

### Step 1: Run the Script
```bash
cd /Users/mark/StudioSix-Pro-Clean
npm run chatgpt-cookies
```

### Step 2: Check Cookie Status
The script will show you:
- ✅ If cookies exist and when they expire
- ❌ If cookies are missing or expired
- 📊 Number of cookies saved

### Step 3: Log In (if needed)
If login is required:
1. Browser window opens automatically
2. Click "Log in" button
3. Enter your ChatGPT credentials
4. Complete any 2FA/verification
5. Wait for chat interface to load
6. Script automatically detects successful login

### Step 4: Automatic Save
The script will:
- Save only OpenAI-related cookies (for security)
- Show expiration dates
- Test that cookies work
- Confirm everything is ready

## 🔧 Advanced Usage

### Direct Script Execution
```bash
node chatgpt-cookie-manager.js
```

### Check Cookie Status Only
The script shows current status before asking to update:
```
🍪 ChatGPT Cookie Manager
========================
✅ Cookies file found: /path/to/chatgpt-cookies.json
📊 Number of cookies: 12

🔑 Session cookies found:
   __Secure-next-auth.session-token: ✅ Valid (expires: Mon Jan 27 2025)
   auth-token: ✅ Valid (expires: Tue Jan 28 2025)

⏰ Cookies expire in: 15 days
```

## 📁 Files Created

### `chatgpt-cookies.json`
- Contains your ChatGPT login session
- Only OpenAI-related cookies (secure)
- Automatically loaded by AI render system
- JSON format for easy inspection

Example structure:
```json
[
  {
    "name": "__Secure-next-auth.session-token",
    "value": "encrypted-session-data",
    "domain": ".chat.openai.com",
    "expires": 1706745600
  }
]
```

## 🛡️ Security Notes

- **Only OpenAI cookies are saved** (not all browser cookies)
- Cookies are stored locally in your project directory
- Never commit `chatgpt-cookies.json` to version control
- Cookies automatically expire and need periodic refresh

## ⚠️ Troubleshooting

### "Login timeout" Error
- You have 5 minutes to complete login
- Make sure to complete all verification steps
- Wait for the chat interface to fully load

### Cookies Not Working
- Try clearing browser data and re-running script
- Make sure you're using the same browser/profile
- Check if ChatGPT changed their login flow

### Permission Errors
- Make sure you have write permissions in the project directory
- Check that no other processes are using the cookies file

## 🔄 Cookie Lifecycle

1. **Fresh Install**: No cookies → Script opens login → Saves cookies
2. **Normal Usage**: AI render uses saved cookies automatically
3. **Expiration**: Cookies expire → AI render shows "login required" → Run script again
4. **Update**: Script detects expired cookies → Opens login → Updates cookies

## 🎯 Integration with AI Render

The AI render system automatically:
- Loads cookies from `chatgpt-cookies.json`
- Uses them for ChatGPT automation
- Shows "login required" status if cookies are invalid
- Works seamlessly once cookies are set up

No code changes needed - just run the cookie manager when needed!













