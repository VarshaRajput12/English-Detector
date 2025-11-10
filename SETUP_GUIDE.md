# Quick Setup Guide

## Getting Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the generated API key

## Setting Up the Project

1. **Add your API key to `.env` file:**

   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

2. **Restart the dev server if it's already running:**
   ```bash
   npm run dev
   ```

## How It Works

### Multi-Speaker Detection

The application automatically detects different speakers using a pause-based algorithm:

- A pause of 2+ seconds indicates a new speaker
- Speakers are labeled as Speaker-1, Speaker-2, etc.
- Each transcript includes a timestamp

### Language Analysis

When you click "Analyze Languages", the Gemini AI:

1. Analyzes the entire conversation
2. Identifies languages for each speaker
3. Calculates English percentage per speaker
4. Provides an overall English speaking percentage
5. Lists all non-English languages detected

## Features Implemented

✅ **Multi-speaker voice recognition** - Automatically separates speakers
✅ **Real-time transcription** - See what's being said as you speak
✅ **Language detection** - Identifies English and other languages
✅ **English percentage calculation** - Shows % of English vs other languages
✅ **Per-speaker analysis** - Detailed breakdown for each speaker
✅ **Minimal dependencies** - Uses only Gemini API for AI analysis

## Testing Tips

1. **Single Speaker Test:**

   - Click "Start Recording"
   - Speak in English for a few seconds
   - Stop and analyze - should show ~100% English

2. **Multi-Speaker Test:**

   - Have 2+ people speak with clear pauses (2+ seconds) between them
   - Each person will be detected as a different speaker
   - Stop and analyze to see per-speaker breakdown

3. **Multi-Language Test:**
   - Speak partly in English and partly in another language
   - The AI will detect the language mix and calculate percentages

## Troubleshooting

**Issue:** "Please add your Gemini API key"

- **Solution:** Make sure `.env` file exists with correct API key format

**Issue:** Speakers not being detected separately

- **Solution:** Ensure 2+ second pauses between speakers

**Issue:** Language detection not accurate

- **Solution:** Speak clearly and ensure good audio quality

**Issue:** Gemini API rate limit

- **Solution:** Free tier allows 60 requests/minute - wait a minute if you hit the limit

## What Changed

### Files Modified:

1. **`src/ZoeSTTDemo.jsx`** - Complete rewrite with multi-speaker support and language analysis
2. **`.gitignore`** - Added .env files to prevent committing API keys
3. **`README.md`** - Comprehensive documentation
4. **`package.json`** - Added @google/generative-ai dependency

### Files Created:

1. **`.env`** - Environment variables (add your API key here)
2. **`.env.example`** - Template for environment variables
3. **`SETUP_GUIDE.md`** - This file

## Next Steps

1. Add your Gemini API key to `.env`
2. Run `npm run dev`
3. Open the app in your browser
4. Click "Start Recording" and test with multiple speakers
5. Click "Analyze Languages" to see the results

Enjoy your multi-speaker English detector! 🎤
