# HealthMate

An AI-powered healthcare platform with medical imaging analysis, doctor-patient communication, and appointment management.

## Overview

HealthMate combines deep learning models for medical image segmentation with real-time chat, appointment scheduling, and voice features. 

### Features

- **Medical Imaging**: AI segmentation for liver, kidney, brain tumors, breast, pancreas
- **Voice-Activated Chat**: Real-time voice communication between patients & doctors with transcription
- **AI Avatar**: Animated avatar interface for patient interactions
- **Appointments**: Schedule and manage appointments with availability tracking
- **Voice Features**: Speech-to-text (Whisper) and text-to-speech (Edge TTS, Piper)
- **Scan Reports**: Automated analysis with statistics and insights
- **Authentication**: JWT-based secure authentication
- **Notifications**: Real-time appointment and message alerts
- **Cross-Platform**: iOS/Android (Expo) and web support

## Tech Stack

**Backend**: FastAPI, Uvicorn, MongoDB, PyTorch, TensorFlow  
**Frontend**: React Native (Expo), TypeScript, React Navigation  
**AI/ML**: Deep learning for medical image segmentation  
**SDKs**: OpenAI Whisper, Edge TTS, Piper TTS, JWT Authentication

## Project Structure

```
Health-Mate/
├── backend/              # FastAPI server
│   ├── app/routes/      # API endpoints (auth, chat, scan, appointment, etc.)
│   ├── app/services/    # Business logic & AI models
│   ├── app/models/      # Database schemas
├── frontend/            # React Native Expo app
│   ├── app/            # Screens & navigation
│   ├── components/     # UI components
│   └── assets/         # Images & resources
├── weights/            # Custom-trained models(Segmentation)
└── requirements.txt    # Python dependencies
```

## API Endpoints

- `/auth` - User registration & login
- `/chat` - Voice-activated conversation between patients & doctors
- `/scan` - Medical image upload & segmentation (liver, kidney, brain, breast, pancreas)
- `/report` - Scan analysis reports
- `/appointment` - Schedule management
- `/doctor-availability` - Doctor availability slots
- `/speech` - Voice transcription & synthesis
- `/notification` - Real-time alerts
- `/profile` - User profile management
- `/avatar` - AI avatar visualization & proxy

## Setup

### Prerequisites
- Python 3.9+, Node.js 16+, MongoDB

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env`:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=healthmate
SECRET_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key
```

Run:
```bash
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

API docs: http://localhost:8000/docs

## Database

MongoDB collections: `users`, `appointments`, `doctor_availability`, `chats`, `scan_reports`, `notifications`

## License

Proprietary and confidential

