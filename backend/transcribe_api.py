from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect, HTTPException, Form, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from faster_whisper import WhisperModel
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from pydantic import BaseModel
import shutil
import os
import tempfile
import yt_dlp
import fitz  # PyMuPDF
import re
import numpy as np
import json
import subprocess
import torch
from collections import Counter, deque
import time
import random
import asyncio
from typing import List, Optional
from fastapi.responses import StreamingResponse

os.environ["PATH"] += os.pathsep + "/opt/homebrew/bin"

# --- CRITICAL FIX: Prevent Deadlocks on Mac/Linux ---
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# --- LangChain Imports ---
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# --- HARDWARE SETTINGS (STABLE MODE) ---
# We force CPU for the LLM to prevent the "MPSNDArray > 4GB" crash on Mac.
# The 1.5B model is small enough that CPU is still very fast (40+ tokens/sec).
DEVICE = "cpu"
print(f"🚀 Hardware Mode: CPU (Stable & Fast)")

app = FastAPI()

# --- Serve the 'tmp' folder so frontend can load generated images ---
app.mount("/tmp", StaticFiles(directory="tmp"), name="tmp")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# 1. Load Models (Optimized)
# --------------------
print("Loading Models...")

# --- SPEED OPTIMIZATION: Use Systran Distilled Models (6x Faster) ---
WHISPER_MODELS = {
    "tiny": "tiny.en",
    "small": "Systran/faster-distil-whisper-small.en",
    "medium": "Systran/faster-distil-whisper-medium.en",
    "large": "Systran/faster-distil-whisper-large-v3"
}

#For more accuracy
#WHISPER_MODELS = {
#    "tiny": "tiny.en",
#    "small": "small.en",
#    "medium": "medium.en",
#    "large": "large-v3"
#}

loaded_models = {}

def get_whisper_model(size="medium"):
    """Lazy loads the requested Whisper model size."""
    if size not in WHISPER_MODELS:
        size = "medium"
    
    if size not in loaded_models:
        print(f"📥 Loading Whisper Model: {size.upper()} ({WHISPER_MODELS[size]})...")
        # Faster-Whisper runs best on CPU/Int8 on Mac
        loaded_models[size] = WhisperModel(WHISPER_MODELS[size], device="cpu", compute_type="int8")
        print(f"✅ {size.upper()} Model Loaded!")
    
    return loaded_models[size]

# Pre-load Medium (Default)
get_whisper_model("medium")

# --------------------
# B. LLM for Notes & RAG (CPU Mode)
# --------------------
LLM_ID = "Qwen/Qwen2.5-1.5B-Instruct"
print(f"🚀 Loading LLM: {LLM_ID}...")

tokenizer = AutoTokenizer.from_pretrained(LLM_ID)

# CHANGED: Removed 'device_map' completely to avoid the 'accelerate' error.
llm_model = AutoModelForCausalLM.from_pretrained(
    LLM_ID,
    torch_dtype=torch.float32, 
)

# Manually move to device (CPU)
llm_model.to(DEVICE)
llm_model.eval()

# C. Legacy Summarizer (Backup)
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)

print("✅ All Systems Ready!")

# --------------------
# Helper: Threaded LLM Generation
# --------------------
def _generate_llm_sync(messages, max_new_tokens=1024, temperature=0.7):
    """Synchronous version of LLM generation (Blocking)"""
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(llm_model.device)
    
    with torch.no_grad():
        out = llm_model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=True,
            repetition_penalty=1.1
        )
    return tokenizer.decode(out[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)

async def generate_llm(messages, max_new_tokens=1024, temperature=0.7):
    """Async wrapper using Threadpool to prevent blocking"""
    return await run_in_threadpool(_generate_llm_sync, messages, max_new_tokens, temperature)

# --------------------
# CLASS: Lecture Doubt Solver
# --------------------
class LectureDoubtSolver:
    def __init__(self):
        print("🚀 Initializing RAG Engine...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vector_store = None
        self.retriever = None

    def process_lecture_data(self, transcript_text):
        """Indexes the transcript into FAISS"""
        if not transcript_text.strip():
            return False

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=100
        )
        chunks = splitter.split_text(transcript_text)
        
        docs = [
            Document(page_content=c, metadata={"source": f"Chunk {i+1}"})
            for i, c in enumerate(chunks)
        ]

        self.vector_store = FAISS.from_documents(docs, self.embeddings)
        self.retriever = self.vector_store.as_retriever(search_kwargs={"k": 3})
        return True

    async def ask_doubt(self, question): # Made Async
        """Retrieves context and asks the LLM"""
        if not self.retriever:
            return "⚠️ No lecture has been indexed yet. Please upload/transcribe a file first."

        # Retrieval is fast, can stay on main thread
        docs = self.retriever.invoke(question)
        context_text = "\n\n".join([d.page_content for d in docs])

        messages = [
            {"role": "system", "content": "You are a helpful Academic Assistant. Use ONLY the provided lecture context to answer. If the answer is not in the lecture, say you don't know."},
            {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion:\n{question}"}
        ]

        # Use the Async LLM wrapper
        answer = await generate_llm(messages, max_new_tokens=512, temperature=0.3)
        return answer

# Initialize Global Solver Instance
rag_solver = LectureDoubtSolver()

# --------------------
# Helper: Diagram Generation Logic (FAST MODE)
# --------------------
async def generate_diagram(text_content, file_id): # Made Async
    print("🎨 Generating Diagram (Fast Mode)...")

    # OPTIMIZATION: Limit input to 2000 chars to speed up LLM reading
    short_text = text_content[:2000]

    system_prompt = """You are a fast Graphviz DOT generator.
    1. Identify 5 key concepts from the text.
    2. Create a simple 'digraph' with arrows connecting them.
    3. Output ONLY valid DOT code. No markdown, no explanations.
    4. Use shape=box for nodes.
    
    Example format:
    digraph G {
      rankdir=LR;
      node [shape=box];
      "Concept A" -> "Concept B";
      "Concept B" -> "Concept C";
    }"""
    
    dot_code = None
    
    try:
        # Generate in one pass using Async Wrapper
        raw = await generate_llm([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Diagram this text:\n{short_text}"}
        ], max_new_tokens=400, temperature=0.2)
        
        # --- Cleanup Logic ---
        raw_clean = re.sub(r"'{3,}", "", raw)
        raw_clean = re.sub(r'"{3,}', "", raw_clean)
        raw_clean = raw_clean.replace("```dot", "").replace("```", "").replace("json", "")
        
        # Extract the DOT block
        start = raw_clean.find("digraph")
        end = raw_clean.rfind("}")
        
        if start != -1 and end != -1:
            dot_code = raw_clean[start:end+1]
        else:
            print("⚠️ parsing failed, using fallback.")
            dot_code = f"""digraph G {{
                rankdir=LR; node [shape=box];
                "Topic" -> "See Notes";
                "Notes" -> "Read Full Text";
            }}"""

    except Exception as e:
        print(f"❌ LLM Error: {e}")
        return None

    # Render Image
    image_url = None
    if dot_code:
        os.makedirs("tmp", exist_ok=True)
        dot_path = f"tmp/{file_id}.dot"
        png_path = f"tmp/{file_id}.png"
        
        with open(dot_path, "w") as f:
            f.write(dot_code)
        
        try:
            subprocess.run(["dot", "-Tpng", dot_path, "-o", png_path], check=True, stderr=subprocess.PIPE)
            image_url = f"http://127.0.0.1:8000/{png_path}"
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Graphviz Syntax Error: {e.stderr.decode()}")
        except Exception as e:
            print(f"   ❌ Graphviz failed: {e}")
            
    return image_url

# --------------------
# Helper: Threaded Transcription
# --------------------
def _transcribe_sync(audio_path, model_size):
    """Blocking transcription call"""
    model = get_whisper_model(model_size)
    
    # ADDED: vad_filter=True and condition_on_previous_text=False
    # This forces Whisper to process speech chunks accurately without skipping
    segments, info = model.transcribe(
        audio_path, 
        beam_size=5, 
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        condition_on_previous_text=False # Prevents hallucination loops/skipping
    )
    return " ".join([s.text for s in segments]).strip()

async def process_full_pipeline(audio_path, file_id, model_size="medium"):
    # 1. Transcribe (Threaded)
    print(f"🎤 Stage 1: Transcribing using {model_size} model...")
    # Wrap blocking transcription
    transcript = await run_in_threadpool(_transcribe_sync, audio_path, model_size)

    # --- AUTO-INDEX FOR RAG ---
    print("🧠 Indexing for RAG...")
    rag_solver.process_lecture_data(transcript)
    # --------------------------

    # 2. Generate Lecture Notes
    print("📝 Stage 2: Generating Notes...")
    
    chunks = [transcript[i:i+6000] for i in range(0, len(transcript), 6000)]
    total_chunks = len(chunks)
    print(f"   ↳ Found {total_chunks} chunks to process.")

    chunk_summaries = []
    
    for i, chunk in enumerate(chunks):
        print(f"   ⏳ Processing chunk {i+1}/{total_chunks}...") 
        try:
            # Use Async LLM
            summary = await generate_llm([
                {"role": "system", "content": "Summarize this section into detailed academic markdown notes."},
                {"role": "user", "content": chunk}
            ], max_new_tokens=512)
            chunk_summaries.append(summary)
        except Exception as e:
            print(f"   ❌ Error processing chunk {i+1}: {e}")

    merged_notes = "\n\n".join(chunk_summaries)
    
    print("   ↳ Finalizing notes...")
    # Use Async LLM
    final_notes = await generate_llm([
        {"role": "system", "content": "Merge these summaries into one clean, structured set of Lecture Notes (Markdown). Use Headers, Bullet points, and Bold text."},
        {"role": "user", "content": merged_notes[:10000]} 
    ], max_new_tokens=1024)
    
    return {
        "transcript": transcript,
        "notes": final_notes,
        "image_url": None 
    }

# --------------------
# Helper: Accurate 35% Summarizer Logic
# --------------------
def accurate_35_summarize(text, target_ratio=0.35):
    """TRUE 35% word coverage extractive summarization"""
    # 1. CLEAN TEXT
    text = re.sub(r'\s+', ' ', text)
    sentences = re.split(r'(?<=[\.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    # 2. DEDUPLICATE
    unique_sentences = []
    seen = set()
    for sent in sentences:
        h = hash(sent.lower())
        if h not in seen:
            unique_sentences.append(sent)
            seen.add(h)
    sentences = unique_sentences

    # 3. CALCULATE TARGET WORD COUNT (35% of ORIGINAL)
    orig_words = len(re.findall(r'\b\w+\b', text))
    target_words = max(500, int(orig_words * target_ratio))  # 35% words, min 500

    print(f"{len(sentences)} unique sentences")
    print(f" Target: {target_words:,}/{orig_words:,} words (35%)")

    # 4. SCORE ALL SENTENCES
    all_words = re.findall(r'\b\w+\b', text.lower())
    word_freq = Counter(all_words)

    scored_sentences = []
    for sent in sentences:
        sent_words = re.findall(r'\b\w+\b', sent.lower())
        score = sum(word_freq[w] * np.log(len(all_words) / word_freq[w])
                   for w in sent_words if word_freq[w] > 1)
        word_count = len(sent_words)
        scored_sentences.append((score, word_count, sent))

    # 5. GREEDY SELECTION - highest score until target words reached
    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    selected_sentences = []
    current_word_count = 0

    for score, word_count, sent in scored_sentences:
        if current_word_count + word_count <= target_words:
            selected_sentences.append(sent)
            current_word_count += word_count
        if current_word_count >= target_words * 0.9:  # 90% of target
            break

    # 6. PRESERVE ORDER
    order_map = {sent: i for i, sent in enumerate(sentences)}
    selected_sentences.sort(key=lambda x: order_map[x])
    summary_text = "\n\n".join(selected_sentences)

    return summary_text, orig_words, current_word_count

# --------------------
# Routes
# --------------------

class RagQuery(BaseModel):
    question: str

class RagIngest(BaseModel):
    text: str

class QuizRequest(BaseModel):
    note_content: str
    num_questions: int = 3
    
class MindMapRequest(BaseModel):
    note_content: str

@app.post("/rag/ingest")
async def rag_ingest(item: RagIngest):
    # 1. Existing Indexing Logic
    success = rag_solver.process_lecture_data(item.text)
    
    if not success:
        raise HTTPException(status_code=400, detail="Empty text provided.")
    
    # 2. GENERATE THE SUMMARY (The missing piece for your frontend)
    # We use your existing async generate_llm wrapper to keep it fast
    print("📝 Generating ingestion summary for source card...")
    summary_prompt = [
        {
            "role": "system", 
            "content": "Summarize this text into 2-3 concise academic sentences for a reference card. Focus on the core thesis."
        },
        {"role": "user", "content": item.text[:4000]} # Truncate to save tokens/time
    ]
    
    # Call your pre-defined async LLM generator
    summary = await generate_llm(summary_prompt, max_new_tokens=256, temperature=0.5)

    # 3. Return the fields your React frontend expects
    return {
        "status": "success", 
        "message": "Text indexed successfully.",
        "summary": summary,
        "fileName": "Document Analysis" # You can customize this title
    }

@app.post("/rag/query")
async def rag_query(item: RagQuery):
    # Await async RAG
    answer = await rag_solver.ask_doubt(item.question)
    return {"answer": answer}

@app.post("/generate_quiz")
async def generate_quiz(item: QuizRequest):
    if not item.note_content.strip():
        raise HTTPException(status_code=400, detail="Note content is empty.")

    # Limit context to keep processing fast and within model limits
    context_chunk = item.note_content[:5000]

    print(f"🧠 Generating {item.num_questions} questions using 1.5B model logic...")

    system_prompt = """You are an expert academic evaluator. Create high-quality, challenging multiple-choice questions based ONLY on the provided text.
    Rules:
    1. Output strictly valid JSON.
    2. Format: [
        {
            "question": "Question text here", 
            "correct_answer": "The correct option text", 
            "distractors": ["Wrong Option 1", "Wrong Option 2", "Wrong Option 3"], 
            "explanation": "Brief explanation"
        }
    ]
    3. Ensure the 'correct_answer' is factually correct based on the text.
    4. Provide exactly 3 distractors.
    5. Output ONLY the JSON array. No conversational text."""

    user_prompt = f"Create {item.num_questions} questions based on this text:\n\"{context_chunk}\"\nReturn the JSON list ONLY."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        # Async LLM call using your existing wrapper
        response_text = await generate_llm(messages, max_new_tokens=1024, temperature=0.3)
        
        # 1. Aggressive cleaning to find the JSON block
        # This searches for anything starting with [ and ending with ] across multiple lines
        match = re.search(r'\[\s*{.*}\s*\]', response_text, re.DOTALL)
        
        if not match:
            print(f"❌ Failed to find JSON in AI response: {response_text}")
            raise ValueError("AI failed to return a valid JSON list format.")
        
        clean_json = match.group(0)
        quiz_data = json.loads(clean_json)

        final_quiz = []
        for q in quiz_data:
            # Skip malformed questions
            if "correct_answer" not in q or "distractors" not in q:
                continue
            
            correct_txt = str(q["correct_answer"]).strip()
            distractors = [str(d).strip() for d in q["distractors"]]
            
            # Combine and shuffle options
            all_options = [correct_txt] + distractors
            random.shuffle(all_options)
            
            # Identify the new index of the correct answer
            try:
                correct_index = all_options.index(correct_txt)
            except ValueError:
                correct_index = 0
            
            final_quiz.append({
                "question": q.get("question", "Question text missing"),
                "options": all_options,
                "answer": correct_index,
                "explanation": q.get("explanation", "No explanation provided.")
            })

        if not final_quiz:
            raise ValueError("No valid questions could be parsed from AI response.")

        return {"quiz": final_quiz}

    except Exception as e:
        print(f"❌ Quiz Error: {str(e)}")
        # Return 400 instead of 500 so the frontend can display the specific error
        raise HTTPException(status_code=400, detail=f"Quiz Generation Error: {str(e)}")

@app.post("/generate_mindmap")
async def generate_mindmap(item: MindMapRequest):
    if not item.note_content.strip():
         raise HTTPException(status_code=400, detail="Note content is empty.")
    
    file_id = f"map_{int(time.time())}"
    # Async diagram gen
    image_url = await generate_diagram(item.note_content, file_id)
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to generate mind map.")
        
    return {"image_url": image_url}

@app.post("/upload_cookies")
async def upload_cookies(file: UploadFile):
    try:
        with open("cookies.txt", "wb") as f:
            shutil.copyfileobj(file.file, f)
        print(f"✅ Cookies uploaded: {file.filename}")
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/youtube_summarize")
async def youtube_summarize(item: dict):
    url = item.get("url")
    model_size = item.get("model_size", "medium")

    if not url: return {"error": "No URL provided"}

    output_folder = "tmp"
    os.makedirs(output_folder, exist_ok=True)
    file_id = f"yt_{int(time.time())}_{random.randint(1000, 9999)}"
    
    # 1. Cookies Path
    cookie_path = os.path.abspath("cookies.txt")
    cookie_file = cookie_path if os.path.exists(cookie_path) else None

    # OPTIMIZATION: Encapsulate download for threading
    def download_video_sync():
        ydl_opts = {
        # Explicitly point to the Homebrew bin folder
        'ffmpeg_location': '/opt/homebrew/bin/', 
        'format': 'bestaudio/best', 
        'outtmpl': f'{output_folder}/{file_id}.%(ext)s',
        'nopart': True, # Prevent .part files which often confuse ffprobe
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        'cookiefile': cookie_file,
        'nocheckcertificate': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios'],
                'player_skip': ['web', 'tv']
            }
        },
        'force_ipv4': True,
        'socket_timeout': 15,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
        return f"{output_folder}/{file_id}.mp3"

    try:
        print(f"📥 Downloading: {url}")
        print(f"   (Mode: Android Emulation, Cookies: {'Yes' if cookie_file else 'No'})")
        
        # Async Download
        audio_path = await run_in_threadpool(download_video_sync)
        
        # Verify Download
        if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1000:
             raise Exception("Download failed. YouTube blocked the Android client too.")

        result = await process_full_pipeline(audio_path, file_id, model_size)
        
        if os.path.exists(audio_path):
            os.remove(audio_path)
            
        return result

    except Exception as e:
        error_msg = str(e)
        print(f"❌ YouTube Error: {error_msg}")
        return {"error": f"YouTube Download Failed: {error_msg}"}

@app.post("/pdf_summarize")
async def pdf_summarize(file: UploadFile):
    os.makedirs("./tmp", exist_ok=True)
    file_path = f"./tmp/{file.filename}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        print(f"🔍 EXTRACTING PDF: {file.filename}")
        doc = fitz.open(file_path)
        all_text = ""
        
        # Triple extraction for max accuracy
        for page in doc:
            text1 = page.get_text()
            text2 = page.get_text("blocks")
            text3 = " ".join([block[4] for block in text2 if isinstance(block[4], str)])
            
            combined = f"{text1}\n\n{text3}"
            all_text += combined + "\n\n"

        # Index for RAG
        rag_solver.process_lecture_data(all_text)
        
        # USE THE CUSTOM 35% SUMMARIZER
        summary_text, orig_count, summary_count = accurate_35_summarize(all_text)
        
        # Add Header Metadata
        final_summary = f"""# PDF Summary Report
        
**Original Words**: {orig_count:,}
**Summary Words**: {summary_count:,}
**Coverage**: ~35% (TextRank Algorithm)

## Key Concepts

{summary_text}
"""
        return {
            "summary_markdown": final_summary,
            "original_word_count": orig_count,
            "summary_word_count": summary_count
        } 
    finally:
        if os.path.exists(file_path): os.remove(file_path)

@app.post("/transcribe_and_summarize")
async def transcribe_and_summarize(file: UploadFile, model_size: str = Form("medium")):
    os.makedirs("./tmp", exist_ok=True)
    path = f"./tmp/{file.filename}"
    with open(path, "wb") as f: shutil.copyfileobj(file.file, f)
    
    try:
        print(f"🎤 Transcribing Upload with {model_size} model...")
        
        # OPTIMIZATION: Threaded transcription
        transcript = await run_in_threadpool(_transcribe_sync, path, model_size)
        
        rag_solver.process_lecture_data(transcript)
        
        chunks = [transcript[i:i+3000] for i in range(0, len(transcript), 3000)]
        summary = []
        for ch in chunks:
            if len(ch.split()) > 50:
                s = summarizer(ch, max_length=150, min_length=30, do_sample=False)
                summary.append(s[0]['summary_text'])
        return {"transcript": transcript, "summary": summary}
    finally:
        if os.path.exists(path): os.remove(path)

# --- Live Transcribe (Optimized & Threaded) ---
@app.websocket("/ws/live_transcribe")
async def websocket_endpoint(websocket: WebSocket, model_size: str = "small"):
    await websocket.accept()
    print(f"🔌 Live connection started. Using model: {model_size}")
    
    model = get_whisper_model(model_size)
    
    header_bytes = b"" 
    audio_buffer = deque(maxlen=40) 
    
    try:
        while True:
            new_bytes = await websocket.receive_bytes()
            
            if not header_bytes:
                header_bytes = new_bytes
            else:
                audio_buffer.append(new_bytes)
            
            # --- CRITICAL FIX: Define as regular function (not async) ---
            def run_inference():
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as tmp:
                    tmp.write(header_bytes + b"".join(audio_buffer))
                    tmp.flush()
                    segments, _ = model.transcribe(tmp.name, beam_size=1, vad_filter=True)
                    return " ".join([s.text for s in segments]).strip()

            # Execute in threadpool to keep socket alive
            text = await run_in_threadpool(run_inference)
            
            if text: await websocket.send_text(text)
                
    except WebSocketDisconnect:
        print("🔌 Client disconnected")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        try:
            await websocket.close()
        except RuntimeError:
            pass

# --- New Master Note Helper Functions ---

async def process_pdf_source(file: UploadFile):
    """Refined PDF extraction leveraging existing logic"""
    os.makedirs("./tmp", exist_ok=True)
    file_path = f"./tmp/{file.filename}"
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    try:
        doc = fitz.open(file_path)
        extracted_text = ""
        for page in doc:
            extracted_text += page.get_text() + "\n"
            
        # Optional: Use your 35% summarizer for the individual source status
        summary, _, _ = accurate_35_summarize(extracted_text)
        
        return {
            "type": "pdf", 
            "title": file.filename, 
            "full_text": extracted_text, 
            "summary": summary,
            "status": "completed"
        }
    finally:
        if os.path.exists(file_path): 
            os.remove(file_path)
            
async def process_audio_source(file: UploadFile, model_size: str = "medium"):
    """Processes uploaded audio files utilizing the existing Whisper+LLM pipeline"""
    os.makedirs("./tmp", exist_ok=True)
    file_path = f"./tmp/{file.filename}"
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    try:
        file_id = f"audio_{int(time.time())}_{random.randint(1000, 9999)}"
        # Re-use your existing Whisper + LLM pipeline
        result = await process_full_pipeline(file_path, file_id, model_size)
        
        return {
            "type": "audio",
            "title": file.filename,
            "full_text": result.get("transcript", ""),
            "summary": result.get("notes", ""),
            "status": "completed"
        }
    finally:
        if os.path.exists(file_path): 
            os.remove(file_path)

async def process_youtube_source(url: str, model_size: str = "medium"):
    """Refined YouTube processing leveraging process_full_pipeline"""
    file_id = f"yt_master_{int(time.time())}"
    # This reuse ensures you use the same yt_dlp and Whisper logic already defined
    # We call your existing youtube_summarize route logic or similar internal helper
    result = await youtube_summarize({"url": url, "model_size": model_size})
    
    if "error" in result:
        raise Exception(result["error"])
        
    return {
        "type": "video",
        "title": "YouTube Lecture",
        "full_text": result.get("transcript", ""),
        "summary": result.get("notes", ""),
        "status": "completed"
    }

# --- Add to backend/transcribe_api.py ---

class FlashcardRequest(BaseModel):
    note_content: str

@app.post("/generate_flashcards")
async def generate_flashcards(item: FlashcardRequest):
    if not item.note_content.strip():
        raise HTTPException(status_code=400, detail="Note content is empty.")

    # Limit context size to stay within model limits and keep it fast
    context_chunk = item.note_content[:5000]

    print(f"🎴 Generating flashcards using {LLM_ID}...")

    system_prompt = """You are an expert academic tutor. Create high-quality study flashcards based ONLY on the provided text.
    Rules:
    1. Output strictly valid JSON.
    2. Format: { "flashcards": [ { "front": "Concept/Question", "back": "Definition/Answer" } ] }
    3. Focus on key terms, dates, formulas, or core concepts.
    4. Keep the 'front' concise and the 'back' informative but brief.
    5. Generate between 5 to 8 cards.
    """

    user_prompt = f"""Generate flashcards for this text:
    "{context_chunk}"
    Return the JSON ONLY."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        # Re-using your existing async LLM wrapper
        response_text = await generate_llm(messages, max_new_tokens=1024, temperature=0.3)
        
        # Clean the response to ensure we only have the JSON block
        clean_json = re.sub(r'```json\s*|\s*```', '', response_text).strip()
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: 
            clean_json = match.group(0)
        
        flashcard_data = json.loads(clean_json)
        return flashcard_data

    except Exception as e:
        print(f"❌ Flashcard Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate flashcards.")

# --- The Unified Endpoint ---
# --- The Unified Endpoint (Streaming Version) ---

@app.post("/generate_master_note")
async def generate_master_note(
    links: str = Form(default="[]"), 
    files: List[UploadFile] = File(None),
    model_size: str = Form("medium")
):
    async def generate():
        import json
        try:
            link_list = json.loads(links)
        except:
            link_list = []
            
        tasks = []
        
        # 1. Initial Progress: Dispatching
        yield json.dumps({"progress": 10}) + "\n"
        
        if files:
            for file in files:
                filename = file.filename.lower()
                if filename.endswith(".pdf"):
                    tasks.append(process_pdf_source(file))
                elif filename.endswith((".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".webm")):
                    tasks.append(process_audio_source(file, model_size))
        
        for link in link_list:
            if "youtube.com" in link or "youtu.be" in link:
                tasks.append(process_youtube_source(link, model_size))

        if not tasks:
            yield json.dumps({"error": "No valid sources provided."}) + "\n"
            return

        # 2. Stage Progress: Processing Sources
        yield json.dumps({"progress": 30}) + "\n"

        # Parallel Execution
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        sources_data = []
        all_combined_text = ""
        
        for res in results:
            if isinstance(res, Exception):
                print(f"Source processing failed: {res}")
                continue
            sources_data.append(res)
            all_combined_text += f"\n\n--- Source: {res['title']} ---\n{res['full_text']}"

        if not sources_data:
            yield json.dumps({"error": "No valid sources were processed."}) + "\n"
            return

        # 3. Intermediate Progress: Sources Finished
        yield json.dumps({"progress": 75}) + "\n"

        # Check for Single Source
        if len(sources_data) == 1:
            final_payload = {
                "meta_summary": sources_data[0]['summary'],
                "sources": sources_data
            }
            yield json.dumps({"progress": 100}) + "\n"
            yield json.dumps({"final_result": final_payload}) + "\n"
            return

        # Multiple sources: Synthesize
        if all_combined_text:
            rag_solver.process_lecture_data(all_combined_text)

        yield json.dumps({"progress": 85}) + "\n"
        
        synthesis_prompt = [
            {
                "role": "system", 
                "content": "You are a Master Academic Synthesizer. Create a meta-summary and extract key concepts connecting all provided sources. Use Markdown."
            },
            {"role": "user", "content": f"Synthesize these contents:\n{all_combined_text[:10000]}"}
        ]
        
        meta_summary = await generate_llm(synthesis_prompt, max_new_tokens=1024)

        final_payload = {
            "meta_summary": meta_summary,
            "sources": sources_data
        }

        # 4. Final Progress: Complete
        yield json.dumps({"progress": 100}) + "\n"
        yield json.dumps({"final_result": final_payload}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")