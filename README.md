# Multi-Speaker English Detector

A React application that recognizes voice from multiple speakers, identifies different languages, and calculates the percentage of English being spoken using Google's Gemini AI API.

## Features

- 🎤 **Multi-Speaker Voice Recognition**: Automatically detects and separates different speakers (Speaker-1, Speaker-2, etc.)
- 🌍 **Language Detection**: Identifies various languages being spoken in the conversation
- 📊 **English Percentage Calculation**: Provides detailed analysis of English vs. other languages
- 🔍 **Per-Speaker Analysis**: Shows language usage breakdown for each speaker
- ⚡ **Real-time Transcription**: Live speech-to-text conversion with partial results

## Prerequisites

- Node.js (v16 or higher)
- A Google Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd english-detector
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Gemini API Key

1. Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and add your Gemini API key:

   ```
   VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

   To get a free API key:

   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the generated key and paste it in your `.env` file

### 4. Run the Application

```bash
npm run dev
```

The application will open in your browser at `http://localhost:5173`

## How to Use

1. **Start Recording**: Click the "Start Recording" button to begin voice recognition
2. **Speak Naturally**: The system will automatically detect different speakers based on pauses in speech
3. **Multiple Speakers**: If multiple people speak with pauses between them, they'll be labeled as Speaker-1, Speaker-2, etc.
4. **Stop Recording**: Click "Stop Recording" when finished
5. **Analyze Languages**: Click "Analyze Languages" to get:
   - Overall English speaking percentage
   - Per-speaker language breakdown
   - List of non-English languages detected
   - Detailed analysis for each speaker

## How Speaker Detection Works

The application uses a simple but effective speaker detection algorithm:

- When speech is detected after a pause of 2+ seconds, it's attributed to a new speaker
- Each speaker is automatically labeled (Speaker-1, Speaker-2, etc.)
- All transcripts are timestamped for reference

## Technology Stack

- **Frontend**: React + Vite
- **Speech Recognition**: @zoe-ng/stt (Web Speech API wrapper)
- **AI Analysis**: Google Gemini AI API (@google/generative-ai)
- **Styling**: Inline CSS (no external CSS frameworks for minimal dependencies)

## Project Structure

```
english-detector/
├── src/
│   ├── ZoeSTTDemo.jsx    # Main component with voice recognition and analysis
│   ├── App.jsx            # Root component
│   └── main.jsx           # Application entry point
├── .env                   # Environment variables (not committed to git)
├── .env.example           # Example environment file
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## API Usage

This application uses the Gemini AI API for language detection and analysis. The free tier of Gemini API includes:

- 60 requests per minute
- Sufficient for personal and development use

## Troubleshooting

### "Please add your Gemini API key" Error

- Make sure you've created a `.env` file in the root directory
- Verify your API key is correctly set as `VITE_GEMINI_API_KEY=your_key_here`
- Restart the development server after adding the API key

### Microphone Not Working

- Ensure you've granted microphone permissions to your browser
- Check that your microphone is properly connected
- Try using HTTPS or localhost (required for Web Speech API)

### Speaker Detection Not Accurate

- Speak with natural pauses between speakers (2+ seconds)
- Ensure clear audio input without background noise
- Consider manually reviewing and editing transcripts if needed

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
