import os
import io
import json
import wave
import logging
import numpy as np
from typing import List, Optional
import speech_recognition as sr
from fastapi import FastAPI, WebSocket, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor
import math
from moviepy.editor import VideoFileClip
from pydub.silence import split_on_silence

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Create debug directory if it doesn't exist
DEBUG_DIR = "debug_audio"
if not os.path.exists(DEBUG_DIR):
    os.makedirs(DEBUG_DIR)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_audio_chunk(chunk_data: bytes, language: str) -> str:
    """Process a single chunk of audio data"""
    recognizer = sr.Recognizer()
    recognizer.energy_threshold = 300
    recognizer.dynamic_energy_threshold = True
    
    # Convert to WAV for recognition
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(chunk_data)
    wav_buffer.seek(0)
    
    # Perform recognition
    with sr.AudioFile(wav_buffer) as source:
        audio = recognizer.record(source)
        try:
            text = recognizer.recognize_google(audio, language=language)
            return text
        except sr.UnknownValueError:
            return ""
        except sr.RequestError as e:
            logger.error(f"Recognition error: {e}")
            return ""

async def process_file(file_path: str, language: str, chunk_duration_ms: int = 30000) -> str:
    """Process an audio file in parallel chunks"""
    try:
        # Load audio file
        audio = AudioSegment.from_file(file_path)
        
        # Convert to mono and set sample rate
        audio = audio.set_channels(1).set_frame_rate(16000)
        
        # Calculate chunks
        total_duration_ms = len(audio)
        chunks = []
        
        # Split into 30-second chunks with 2-second overlap
        overlap_ms = 2000
        for start_ms in range(0, total_duration_ms, chunk_duration_ms - overlap_ms):
            end_ms = min(start_ms + chunk_duration_ms, total_duration_ms)
            chunk = audio[start_ms:end_ms]
            chunks.append(chunk.raw_data)
        
        logger.info(f"Split audio into {len(chunks)} chunks")
        
        # Process chunks in parallel
        with ThreadPoolExecutor(max_workers=min(os.cpu_count(), len(chunks))) as executor:
            futures = [
                executor.submit(process_audio_chunk, chunk, language)
                for chunk in chunks
            ]
            
            # Gather results
            texts = []
            for future in futures:
                try:
                    text = future.result()
                    if text:
                        texts.append(text)
                except Exception as e:
                    logger.error(f"Error processing chunk: {e}")
            
            return " ".join(texts)
            
    except Exception as e:
        logger.error(f"Error processing file: {e}")
        raise

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
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_chunk:
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

@app.post("/api/upload-file")
async def upload_file(file: UploadFile = File(...), language: str = Form(...)):
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Process the file
            text = await process_file(temp_path, language)
            return {"text": text}
        finally:
            # Clean up temporary file
            os.unlink(temp_path)
            
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return {"error": str(e)}

@app.post("/api/clear-debug")
async def clear_debug_files():
    try:
        for file in os.listdir(DEBUG_DIR):
            file_path = os.path.join(DEBUG_DIR, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.error(f"Error deleting {file_path}: {e}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing debug directory: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/extract-audio")
async def extract_audio(file: UploadFile = File(...), language: str = Form(default="de-DE")):
    try:
        logger.info(f"Processing file: {file.filename} with language: {language}")
        
        if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
            raise Exception("Unsupported file format. Please upload MP4, MOV, or AVI files.")

        # Create a temporary file to store the uploaded video
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
            logger.info(f"Created temporary video file: {temp_video.name}")
            content = await file.read()
            temp_video.write(content)
            video_path = temp_video.name

        # Extract audio from video
        video = VideoFileClip(video_path)
        if video.audio is None:
            raise Exception("No audio track found in the video file.")
        
        # Create a temporary file for the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
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
                raise Exception("Could not extract any text from the audio. Please ensure the audio is clear and contains speech.")
        finally:
            # Clean up temporary files
            os.unlink(video_path)
            os.unlink(audio_path)

        return {"text": text}

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise Exception(str(e))

@app.websocket("/ws/{language}")
async def websocket_endpoint(websocket: WebSocket, language: str):
    await websocket.accept()
    logger.info(f"WebSocket connected, language: {language}")
    chunks_received = 0
    
    class AudioProcessor:
        def __init__(self, language: str):
            self.language = language
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = 300
            self.recognizer.dynamic_energy_threshold = True
            self.buffer: List[np.ndarray] = []
            self.samples_collected = 0
            self.last_text = ""
            self.chunk_count = 0
            # Sample rate is 16000Hz, so 80000 samples = 5 seconds
            self.min_samples_to_process = 80000
            logger.info(f"AudioProcessor initialized with language: {language}")
        
        def add_audio(self, audio_data: bytes) -> Optional[str]:
            # Convert incoming audio to numpy array
            audio_chunk = np.frombuffer(audio_data, dtype=np.int16)
            
            # Add to buffer
            self.buffer.append(audio_chunk)
            self.samples_collected += len(audio_chunk)
            
            # Process if we have enough audio (5 seconds)
            if self.samples_collected >= self.min_samples_to_process:
                logger.info(f"Processing buffer with {self.samples_collected} samples ({self.samples_collected/16000:.2f} seconds)")
                return self._process_buffer()
            return None
        
        def _process_buffer(self) -> Optional[str]:
            try:
                # Combine all chunks
                full_audio = np.concatenate(self.buffer)
                logger.info(f"Combined audio shape: {full_audio.shape}")
                
                # Save debug audio file
                self.chunk_count += 1
                debug_filename = os.path.join(DEBUG_DIR, f"debug_audio_{self.chunk_count}.wav")
                with wave.open(debug_filename, 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(16000)
                    wav_file.writeframes(full_audio.tobytes())
                logger.info(f"Saved debug audio file: {debug_filename}")
                
                # Create WAV file in memory for recognition
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(16000)
                    wav_file.writeframes(full_audio.tobytes())
                wav_buffer.seek(0)
                
                # Perform speech recognition
                with sr.AudioFile(wav_buffer) as source:
                    logger.info("Reading audio file")
                    audio = self.recognizer.record(source)
                    logger.info("Starting speech recognition")
                    try:
                        text = self.recognizer.recognize_google(audio, language=self.language)
                        logger.info(f"Recognition result: {text}")
                        if text and text != self.last_text:
                            self.last_text = text
                            return text
                        elif text:
                            logger.info("Text was same as last result, skipping")
                        else:
                            logger.info("No text returned from recognition")
                    except sr.UnknownValueError:
                        logger.info("No speech detected in audio")
                    except sr.RequestError as e:
                        logger.error(f"Recognition error: {e}")
                        
            except Exception as e:
                logger.error(f"Error processing audio: {e}", exc_info=True)
            finally:
                # Keep last 2.5 seconds for context
                if self.samples_collected > 40000:
                    last_samples = np.concatenate(self.buffer)[-40000:]
                    self.buffer = [last_samples]
                    self.samples_collected = len(last_samples)
                    logger.info(f"Keeping {len(last_samples)} samples ({len(last_samples)/16000:.2f} seconds) for context")
                else:
                    self.buffer = []
                    self.samples_collected = 0
                    logger.info("Cleared buffer")
            
            return None

    processor = AudioProcessor(language)
    
    try:
        while True:
            try:
                # Receive audio chunk
                audio_data = await websocket.receive_bytes()
                chunks_received += 1
                
                # Process audio
                text = processor.add_audio(audio_data)
                if text:
                    await websocket.send_text(json.dumps({"text": text}))
                    logger.info(f"Sent text: {text}")
                    
            except Exception as e:
                logger.error(f"Error processing audio chunk: {str(e)}", exc_info=True)
                await websocket.send_text(json.dumps({"error": str(e)}))
                break
                
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}", exc_info=True)
    finally:
        logger.info(f"WebSocket disconnected after receiving {chunks_received} chunks")

@app.get("/")
async def read_root():
    return {"message": "Extract Speech, Read with Ease!"}
