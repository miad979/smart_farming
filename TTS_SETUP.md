# Voice Reading (Text-to-Speech) Setup Guide

## Overview

The Smart Farming app now includes **real voice reading** (TTS - Text-to-Speech) functionality with support for both **Bengali** and **English** languages.

### Features:
- ✅ **Real TTS Support** with Google Cloud TTS or ElevenLabs
- ✅ **Fallback to Browser Web Speech API** (always available)
- ✅ **Language-Aware** - Bengali (bn) and English (en)
- ✅ **Audio Caching** - Reduces API calls for repeated text
- ✅ **Speed Control** - 0.75x, 1x, 1.25x, 1.5x playback speeds
- ✅ **Loading States** - Shows loading spinner while generating audio

## Default Behavior (No Configuration Required)

By default, the app uses the **Browser Web Speech API** for voice synthesis:
- **No API keys needed**
- **Works offline**
- **Bengali language support** varies by browser
- **English language support** is universally reliable

The VoicePlayer component shows "🌐 Browser" indicator when using Web Speech API.

## Setting Up Real TTS (Optional)

### Option 1: Google Cloud Text-to-Speech

#### Setup Steps:

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project
   - Enable the "Cloud Text-to-Speech API"

2. **Create an API Key**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

3. **Set Environment Variable**
   ```bash
   # On Windows (temporary):
   $env:GOOGLE_CLOUD_TTS_API_KEY = 'your-api-key-here'
   npm run dev

   # On Windows (permanent):
   setx GOOGLE_CLOUD_TTS_API_KEY "your-api-key-here"
   ```

4. **Supported Voices**
   - **English**: `en-US-Neural2-C` (natural sounding)
   - **Bengali**: `bn-IN-Standard-A` (Indian Bengali)

### Option 2: ElevenLabs

#### Setup Steps:

1. **Sign Up**
   - Go to https://elevenlabs.io/
   - Create a free account
   - Get your API key from settings

2. **Set Environment Variable**
   ```bash
   # On Windows (temporary):
   $env:ELEVENLABS_API_KEY = 'your-api-key-here'
   npm run dev

   # On Windows (permanent):
   setx ELEVENLABS_API_KEY "your-api-key-here"
   ```

3. **Features**
   - Premium voice quality
   - Multiple voice options
   - Better natural language processing

## How It Works

### Request Flow:
```
User clicks "Listen" button
    ↓
VoicePlayer generates speech request
    ↓
Backend /tts/generate endpoint
    ↓
Try Google Cloud TTS (if API key configured)
    ↓ (if no key or error)
Try ElevenLabs (if API key configured)
    ↓ (if no key or error)
Return web-speech fallback
    ↓
Frontend plays audio or uses Web Speech API
```

### TTS Endpoint: `POST /api/tts/generate`

**Request:**
```json
{
  "text": "The text to read aloud",
  "language": "en" // or "bn" for Bengali
}
```

**Response (with Google Cloud TTS):**
```json
{
  "provider": "google-cloud-tts",
  "audioContent": "base64-encoded-mp3-data",
  "language": "en-US",
  "text": "The text to read aloud"
}
```

**Response (with ElevenLabs):**
```json
{
  "provider": "elevenlabs",
  "audioContent": "base64-encoded-mp3-data",
  "language": "en",
  "text": "The text to read aloud"
}
```

**Response (fallback):**
```json
{
  "provider": "web-speech",
  "text": "The text to read aloud",
  "language": "en-US",
  "message": "Using browser Web Speech API for voice synthesis"
}
```

## Using the Voice Player

### In Components:

```tsx
import { VoicePlayer } from '../components/VoicePlayer';

export function MyComponent() {
  return (
    <VoicePlayer
      text="রোগের নাম"              // Bengali text
      textEn="Disease Name"          // English text
      textFull="আরও বিস্তৃত বর্ণনা"  // Full Bengali description
      textEnFull="More detailed description"
      autoPlayOnChange={false}       // Auto-play on text change
    />
  );
}
```

### Props:
- `text` (string, required) - Bengali text to read
- `textEn` (string, required) - English text to read
- `textFull` (string, optional) - Extended Bengali text
- `textEnFull` (string, optional) - Extended English text
- `autoPlayOnChange` (boolean, optional) - Auto-play when props change

### UI Controls:
- **Listen** - Play voice (or Pause if playing)
- **Speed** - Change playback speed (0.75x, 1x, 1.25x, 1.5x)
- **Replay** - Reset and play again
- **Stop** - Stop current playback
- **Provider Badge** - Shows "🎙️ Real TTS" or "🌐 Browser"

## Performance Considerations

### Caching:
- Audio is cached in-memory for 1 hour
- Cache key: `language:text-first-200-chars`
- Reduces API calls for repeated content

### API Limits:
- **Google Cloud TTS**: 
  - Free tier: 1 million characters/month
  - Pay-as-you-go: $16 per 1M characters
  
- **ElevenLabs**: 
  - Free tier: ~11,000 characters/month
  - Paid plans: Starting at $5/month

### Optimization:
- Cache results to avoid repeated API calls
- Use concise text where possible
- Monitor API usage in provider dashboards

## Troubleshooting

### Issue: Still showing browser voice instead of real TTS
**Solution:**
1. Check API key is set: `echo $env:GOOGLE_CLOUD_TTS_API_KEY`
2. Restart dev server after setting env var
3. Check browser console for API errors

### Issue: No sound playing
**Solution:**
1. Check browser volume
2. Check browser speaker permissions
3. Try refreshing the page
4. Check browser console for errors

### Issue: Bengali audio sounds incorrect
**Solution:**
1. Google Cloud TTS uses Indian Bengali (bn-IN)
2. For Dhaka Bengali specifically, try ElevenLabs
3. Or use browser Web Speech API (no quality issues)

## Advanced Configuration

### Custom TTS Provider:

To add a custom TTS provider, modify `server/local-api.cjs`:

```javascript
async function generateTtsWithCustomProvider(text, language, apiKey) {
  // Make API call to your custom provider
  const response = await fetch('https://your-tts-provider.com/api/synthesize', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ text, language }),
  });
  
  const result = await response.json();
  return {
    provider: 'custom-tts',
    audioContent: result.audio, // Base64 encoded
    language,
    text,
  };
}
```

Then call it in `generateTtsAudio()` function as a fallback option.

## Testing

### Test with Different Languages:

1. **English Voice Test**:
   - Go to Disease Detection page
   - Switch language to English
   - Read disease description aloud

2. **Bengali Voice Test**:
   - Go to Disease Detection page
   - Switch language to Bengali
   - Read disease description aloud

### Expected Results:
- ✅ Audio plays immediately (or after a brief delay for real TTS)
- ✅ Speed controls work smoothly
- ✅ Stop/Replay buttons are responsive
- ✅ Provider badge shows correct source

## Future Enhancements

Potential improvements:
- [ ] Support for more languages (Hindi, Urdu, etc.)
- [ ] Speaker selection UI
- [ ] Voice rate customization
- [ ] Offline TTS support with local models
- [ ] Download generated audio as MP3
- [ ] History of generated audio

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API provider documentation
3. Check browser console for detailed error messages
4. Open an issue in the repository
