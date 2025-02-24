# Speech to Text Extractor

A web application that extracts text from video/audio files using TypeScript + React + Tailwind CSS for the frontend and Python + FastAPI for the backend.

## Features
- Upload video files through drag & drop or file selector
- Extract text from video/audio
- Display extracted text results

## Project Structure
- `frontend/`: React + TypeScript + Tailwind CSS application
- `backend/`: Python + FastAPI server

## Requirements
### Frontend
- Node.js
- npm/yarn
- TypeScript
- React
- Tailwind CSS

### Backend
- Python 3.12+
- FastAPI
- moviepy
- speech_recognition

## Setup Instructions
1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
