from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from transformers import pipeline
import shutil
import os

app = FastAPI()

# --------------------
# CORS setup
# --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# Load models once at startup
# --------------------
whisper_model = WhisperModel("distil-large-v3", device="cpu", compute_type="int8")
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=0)

# --------------------
# Route: Transcribe and Summarize
# --------------------
@app.post("/transcribe_and_summarize")
async def transcribe_and_summarize(file: UploadFile):
    # Save uploaded audio to temp folder
    audio_path = f"/tmp/{file.filename}"
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Transcribe audio
    segments, _ = whisper_model.transcribe(audio_path, beam_size=5)
    full_transcript = "".join([s.text for s in segments])

    # Summarize in chunks
    chunk_size = 3000
    chunks = [full_transcript[i:i+chunk_size] for i in range(0, len(full_transcript), chunk_size)]
    bullet_points = []

    for chunk in chunks:
        input_len = len(chunk.split())
        max_len = min(150, input_len // 2)
        min_len = min(30, max_len // 2)

        try:
            summary = summarizer(chunk, max_length=max_len, min_length=min_len, do_sample=False)
            bullet_points.append(f"- {summary[0]['summary_text']}")
        except Exception as e:
            bullet_points.append(f"- Error summarizing chunk: {e}")

    # Clean up temporary file
    if os.path.exists(audio_path):
        os.remove(audio_path)

    return {
        "transcript": full_transcript,
        "summary": bullet_points
    }
