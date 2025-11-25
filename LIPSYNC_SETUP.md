# Lip-Sync Setup Guide

## Overview
This project uses **Piper TTS** for fast, local text-to-speech and **Rhubarb Lip Sync** for generating viseme timing data.

## Prerequisites

### 1. Install Piper TTS

**Windows:**
```powershell
# Download Piper from GitHub releases
# https://github.com/rhasspy/piper/releases

# Extract to a location and add to PATH, or:
# Download and run installer
winget install rhasspy.piper
```

**Linux/Mac:**
```bash
# Using pip (Python package)
pip install piper-tts

# Or download binary from GitHub releases
# https://github.com/rhasspy/piper/releases
```

### 2. Download Voice Models

Download voice models for English and Urdu:

```bash
# English voice (female, clear)
# Download from: https://huggingface.co/rhasspy/piper-voices
# Model: en_US-lessac-medium

# Urdu voice
# Model: ur_PK-mixed-medium
```

Place models in: `~/.local/share/piper/voices/` (Linux/Mac) or `%APPDATA%\piper\voices\` (Windows)

### 3. Install Rhubarb Lip Sync

**Windows:**
```powershell
# Download from GitHub releases
# https://github.com/DanielSWolf/rhubarb-lip-sync/releases

# Extract and add to PATH
```

**Linux/Mac:**
```bash
# Download from GitHub releases
wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/Rhubarb-Lip-Sync-1.13.0-Linux.zip
unzip Rhubarb-Lip-Sync-1.13.0-Linux.zip
sudo mv rhubarb /usr/local/bin/
```

### 4. Verify Installation

```bash
# Test Piper
piper --version

# Test Rhubarb
rhubarb --version
```

## Backend Installation

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create media directories (automatic on first run)
mkdir -p media/audio
```

## API Endpoints

### 1. Generate Speech (TTS Only)
```http
POST /speech/generate
Content-Type: application/json

{
  "text": "Hello, how are you feeling today?",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "audio_url": "/media/audio/speech_20231123_123456_abc123.wav",
  "filename": "speech_20231123_123456_abc123.wav",
  "duration": 3.5,
  "language": "en"
}
```

### 2. Generate Speech with Lip-Sync
```http
POST /speech/lipsync
Content-Type: application/json

{
  "text": "Hello, how are you feeling today?",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "audio_url": "/media/audio/speech_20231123_123456_abc123.wav",
  "filename": "speech_20231123_123456_abc123.wav",
  "duration": 3.5,
  "visemes": [
    {"time": 0.0, "type": "viseme_sil"},
    {"time": 0.1, "type": "viseme_PP"},
    {"time": 0.3, "type": "viseme_aa"},
    ...
  ],
  "language": "en"
}
```

## Viseme Mapping

Rhubarb → Ready Player Me:
- `X` → `viseme_sil` (Silence)
- `A` → `viseme_aa` (Open vowel)
- `B` → `viseme_PP` (Lips together)
- `C` → `viseme_E` (Slightly open)
- `D` → `viseme_aa` (Open)
- `E` → `viseme_O` (Rounded)
- `F` → `viseme_FF` (Lips against teeth)
- `G` → `viseme_kk` (Back of tongue)
- `H` → `viseme_CH` (Affricates)

## Performance

- **Piper TTS**: 0.3-0.5 seconds (local, offline)
- **Rhubarb**: 2-5 seconds (depends on audio length)
- **Total**: ~3-6 seconds for full lip-sync generation

## Troubleshooting

### Piper not found
```bash
# Add Piper to PATH or use full path in speech_service.py
# Update line: cmd = ["piper", ...] 
# To: cmd = ["/full/path/to/piper", ...]
```

### Rhubarb not found
```bash
# Same as Piper - add to PATH or use full path
```

### Voice models missing
```bash
# Piper will download models automatically on first use
# Or manually download from: https://huggingface.co/rhasspy/piper-voices
```

### Audio files not accessible
```bash
# Ensure media directory exists and has proper permissions
chmod -R 755 media/
```

## Next Steps

1. Install Piper + Rhubarb
2. Test endpoints with Postman/cURL
3. Integrate with frontend (avatar-viewer.html)
4. Add viseme scheduling logic to Three.js
