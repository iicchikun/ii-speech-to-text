from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import speech_recognition as sr
from moviepy.editor import VideoFileClip
import os
from tempfile import NamedTemporaryFile
import logging
from pydub import AudioSegment
from pydub.silence import split_on_silence
import math

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def normalize_audio(audio):
    """Normalize audio volume."""
    return audio.normalize(headroom=0.1)

def process_audio_with_silence_detection(audio_path: str, language: str) -> str:
    """Process audio file by detecting silence and splitting into chunks."""
    recognizer = sr.Recognizer()
    
    # Load and normalize audio file
    audio = AudioSegment.from_wav(audio_path)
    audio = normalize_audio(audio)
    
    # Split audio on silence
    # min_silence_len: minimum length of silence (in ms)
    # silence_thresh: silence threshold in dB
    # keep_silence: amount of silence to keep at the boundaries (in ms)
    chunks = split_on_silence(
        audio,
        min_silence_len=1000,  # 1 second
        silence_thresh=-40,     # adjust based on audio
        keep_silence=500        # keep 0.5 seconds of silence
    )
    
    logger.info(f"Split audio into {len(chunks)} segments based on silence")
    
    full_text = []
    
    for i, chunk in enumerate(chunks):
        logger.info(f"Processing segment {i+1}/{len(chunks)}")
        
        # Ensure minimum chunk length
        if len(chunk) < 500:  # Skip chunks shorter than 0.5 seconds
            continue
            
        # Export chunk to temporary file
        with NamedTemporaryFile(delete=False, suffix=".wav") as temp_chunk:
            chunk_path = temp_chunk.name
            # Add a bit of silence at the beginning and end
            silence = AudioSegment.silent(duration=100)
            audio_chunk = silence + chunk + silence
            audio_chunk.export(chunk_path, format="wav")
        
        # Process chunk
        try:
            with sr.AudioFile(chunk_path) as source:
                # Adjust recognition settings
                recognizer.energy_threshold = 300
                recognizer.dynamic_energy_threshold = True
                recognizer.pause_threshold = 0.8
                recognizer.phrase_threshold = 0.3
                recognizer.non_speaking_duration = 0.5
                
                audio_data = recognizer.record(source)
                try:
                    text = recognizer.recognize_google(
                        audio_data,
                        language=language
                    )
                    full_text.append(text)
                    logger.info(f"Successfully transcribed segment {i+1}")
                except sr.UnknownValueError:
                    logger.warning(f"Could not understand audio in segment {i+1}")
                    continue
                except sr.RequestError as e:
                    logger.error(f"Error with Google Speech Recognition service in segment {i+1}: {str(e)}")
                    continue
        finally:
            # Clean up temporary chunk file
            os.unlink(chunk_path)
    
    return " ".join(full_text)

@app.post("/extract-audio")
async def extract_audio(file: UploadFile = File(...), language: str = Form(default="de-DE")):
    try:
        logger.info(f"Processing file: {file.filename} with language: {language}")
        
        if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload MP4, MOV, or AVI files.")

        # Create a temporary file to store the uploaded video
        with NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
            logger.info(f"Created temporary video file: {temp_video.name}")
            content = await file.read()
            temp_video.write(content)
            video_path = temp_video.name

        # Extract audio from video
        video = VideoFileClip(video_path)
        if video.audio is None:
            raise HTTPException(status_code=400, detail="No audio track found in the video file.")
        
        # Create a temporary file for the audio
        with NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            logger.info(f"Created temporary audio file: {temp_audio.name}")
            audio_path = temp_audio.name
            # Extract audio with specific parameters
            video.audio.write_audiofile(
                audio_path,
                codec='pcm_s16le',    # Use WAV codec
                ffmpeg_params=[
                    "-ac", "1",        # Convert to mono
                    "-ar", "44100",    # Set sample rate
                    "-af", "highpass=f=200,lowpass=f=3000"  # Apply frequency filters
                ]
            )
            logger.info("Audio extraction completed")
            video.close()

        # Process the audio
        try:
            text = process_audio_with_silence_detection(audio_path, language)
            if not text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract any text from the audio. Please ensure the audio is clear and contains speech."
                )
        finally:
            # Clean up temporary files
            os.unlink(video_path)
            os.unlink(audio_path)

        return {"text": text}

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Video Audio Text Extractor API"}
