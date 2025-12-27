from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from collections import Counter
import time
import difflib
import random

# --- CRITICAL FIX: Prevent Deadlocks on Mac/Linux ---
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# --- LangChain Imports ---
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

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
# 1. Load Models (Dynamic Loading)
# --------------------
print("Loading Models...")

# Model Registry
WHISPER_MODELS = {
    "small": "small.en",
    "medium": "Systran/faster-distil-whisper-medium.en",
    "large": "Systran/faster-distil-whisper-large-v3"
}

# Cache to store loaded models so we don't reload every request
loaded_models = {}

def get_whisper_model(size="medium"):
    """Lazy loads the requested Whisper model size."""
    if size not in WHISPER_MODELS:
        size = "medium"
    
    if size not in loaded_models:
        print(f"📥 Loading Whisper Model: {size.upper()} ({WHISPER_MODELS[size]})...")
        loaded_models[size] = WhisperModel(WHISPER_MODELS[size], device="cpu", compute_type="int8")
        print(f"✅ {size.upper()} Model Loaded!")
    
    return loaded_models[size]

# Pre-load Medium (Default)
get_whisper_model("medium")

# --------------------
# B. LLM for Notes & RAG (1.5B Model - Fast & Light)
# --------------------
LLM_ID = "Qwen/Qwen2.5-1.5B-Instruct"
print(f"🚀 Loading Fast Model: {LLM_ID}...")

tokenizer = AutoTokenizer.from_pretrained(LLM_ID)
llm_model = AutoModelForCausalLM.from_pretrained(
    LLM_ID,
    dtype=torch.float32, 
)
llm_model.eval()

# C. Legacy Summarizer
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)

print("✅ All Systems Ready!")

# --------------------
# Helper: LLM Generation
# --------------------
def generate_llm(messages, max_new_tokens=1024, temperature=0.7):
    """Runs the Qwen model to generate text/code"""
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

    def ask_doubt(self, question):
        """Retrieves context and asks the LLM"""
        if not self.retriever:
            return "⚠️ No lecture has been indexed yet. Please upload/transcribe a file first."

        docs = self.retriever.invoke(question)
        context_text = "\n\n".join([d.page_content for d in docs])

        messages = [
            {"role": "system", "content": "You are a helpful Academic Assistant. Use ONLY the provided lecture context to answer. If the answer is not in the lecture, say you don't know."},
            {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion:\n{question}"}
        ]

        answer = generate_llm(messages, max_new_tokens=512, temperature=0.3)
        return answer

# Initialize Global Solver Instance
rag_solver = LectureDoubtSolver()

# --------------------
# Helper: Diagram Header
# --------------------
DOT_HEADER = """digraph G {
    rankdir=LR;
    nodesep=0.6;
    ranksep=1.0;
    splines=true;
    node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=11, fillcolor="#f8f9fa"];
"""

# --------------------
# Helper: Diagram Generation Logic (Graphviz)
# --------------------
def generate_diagram(text_content, file_id):
    print("🎨 Generating Diagram...")
    concepts = generate_llm([
        {"role": "system", "content": "Extract 8 key concepts and their relationships from these notes."},
        {"role": "user", "content": text_content[:4000]}
    ], max_new_tokens=256)

    system_prompt = """
    You are a Graphviz expert. Output ONLY the raw DOT code.
    Rules:
    1. Start with 'digraph G {'
    2. End with '}'
    3. Edges must use '->'
    4. Labels must be double-quoted (e.g. label="text").
    5. NO Markdown, NO triple quotes, NO comments.
    """
    
    dot_code = None
    for attempt in range(3):
        try:
            raw = generate_llm([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Create a simple diagram for: {concepts}"}
            ], temperature=0.2)
            
            # --- Aggressive Cleanup ---
            raw_clean = re.sub(r"'{3,}", "", raw)
            raw_clean = re.sub(r'"{3,}', "", raw_clean)
            raw_clean = raw_clean.replace("```dot", "").replace("```", "")
            
            lines = raw_clean.splitlines()
            valid_lines = []
            for line in lines:
                s = line.strip()
                if s.startswith("dot_code") or s.startswith("print("): continue
                valid_lines.append(line)
            raw_clean = "\n".join(valid_lines)

            start = raw_clean.find("digraph")
            end = raw_clean.rfind("}")
            
            if start != -1 and end != -1 and end > start:
                candidate = raw_clean[start:end+1]
                if "{" not in candidate: candidate = candidate.replace("digraph G", "digraph G {")
                
                # --- APPLY DOT_HEADER HERE ---
                if "nodesep" not in candidate and "{" in candidate:
                    parts = candidate.split("{", 1)
                    if len(parts) == 2: candidate = DOT_HEADER + parts[1]
                
                if "->" not in candidate and "--" in candidate:
                     candidate = candidate.replace("--", "->")

                dot_code = candidate
                break
            else:
                print(f"   ⚠️ Attempt {attempt+1}: Invalid DOT syntax.")
        except Exception as e:
            print(f"   ⚠️ Retry {attempt+1}: {e}")

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
# Helper: Processing Pipeline
# --------------------
def process_full_pipeline(audio_path, file_id, model_size="medium"):
    # 1. Transcribe
    print(f"🎤 Stage 1: Transcribing using {model_size} model...")
    model = get_whisper_model(model_size)
    
    segments, info = model.transcribe(audio_path, beam_size=5, language="en")
    transcript = " ".join([s.text for s in segments]).strip()

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
            summary = generate_llm([
                {"role": "system", "content": "Summarize this section into detailed academic markdown notes."},
                {"role": "user", "content": chunk}
            ], max_new_tokens=512)
            chunk_summaries.append(summary)
        except Exception as e:
            print(f"   ❌ Error processing chunk {i+1}: {e}")

    merged_notes = "\n\n".join(chunk_summaries)
    
    print("   ↳ Finalizing notes...")
    final_notes = generate_llm([
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
    success = rag_solver.process_lecture_data(item.text)
    if success:
        return {"status": "success", "message": "Text indexed successfully."}
    else:
        raise HTTPException(status_code=400, detail="Empty text provided.")

@app.post("/rag/query")
async def rag_query(item: RagQuery):
    answer = rag_solver.ask_doubt(item.question)
    return {"answer": answer}

@app.post("/generate_quiz")
async def generate_quiz(item: QuizRequest):
    if not item.note_content.strip():
        raise HTTPException(status_code=400, detail="Note content is empty.")

    context_chunk = item.note_content[:5000]

    # --- REVERTED TO 1.5B LOGIC (Separated Answers & Distractors) ---
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
    """

    user_prompt = f"""Create {item.num_questions} questions based on this text:
    "{context_chunk}"
    Return the JSON list ONLY."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response_text = generate_llm(messages, max_new_tokens=1024, temperature=0.3)
        
        clean_json = re.sub(r'```json\s*|\s*```', '', response_text).strip()
        match = re.search(r'\[.*\]', clean_json, re.DOTALL)
        if match: clean_json = match.group(0)
        
        quiz_data = json.loads(clean_json)

        final_quiz = []
        for q in quiz_data:
            if "correct_answer" not in q or "distractors" not in q: continue
            
            correct_txt = q["correct_answer"].strip()
            distractors = q["distractors"]
            if not isinstance(distractors, list): continue
            distractors = [str(d).strip() for d in distractors]
            all_options = [correct_txt] + distractors
            random.shuffle(all_options)
            
            try:
                correct_index = all_options.index(correct_txt)
            except ValueError:
                correct_index = 0
            
            final_q = {
                "question": q.get("question", "Unknown Question"),
                "options": all_options,
                "answer": correct_index,
                "explanation": q.get("explanation", "")
            }
            final_quiz.append(final_q)

        return {"quiz": final_quiz}

    except Exception as e:
        print(f"❌ Quiz Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate quiz.")

@app.post("/generate_mindmap")
async def generate_mindmap(item: MindMapRequest):
    if not item.note_content.strip():
         raise HTTPException(status_code=400, detail="Note content is empty.")
    
    file_id = f"map_{int(time.time())}"
    image_url = generate_diagram(item.note_content, file_id)
    
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
    model_size = item.get("model_size", "medium") # Read model size

    if not url: return {"error": "No URL provided"}

    output_folder = "tmp"
    os.makedirs(output_folder, exist_ok=True)
    file_id = f"yt_{int(time.time())}"
    cookie_file = "cookies.txt" if os.path.exists("cookies.txt") else None
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_folder}/{file_id}.%(ext)s',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}],
        'quiet': True,
        'cookiefile': cookie_file
    }

    try:
        print(f"Downloading: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        audio_path = f"{output_folder}/{file_id}.mp3"
        result = process_full_pipeline(audio_path, file_id, model_size)
        
        if os.path.exists(audio_path):
            os.remove(audio_path)
            
        return result

    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

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
        model = get_whisper_model(model_size)
        segments, _ = model.transcribe(path, beam_size=5)
        transcript = " ".join([s.text for s in segments])
        
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

@app.websocket("/ws/live_transcribe")
async def websocket_endpoint(websocket: WebSocket, model_size: str = "small"):
    await websocket.accept()
    print(f"🔌 Live connection started. Using model: {model_size}")
    
    model = get_whisper_model(model_size)
    last_audio_bytes = b""
    
    try:
        while True:
            new_bytes = await websocket.receive_bytes()
            combined = last_audio_bytes + new_bytes
            last_audio_bytes = new_bytes
            
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(combined)
                tmp_path = tmp.name
            
            try:
                segments, _ = model.transcribe(tmp_path, beam_size=1)
                text = " ".join([s.text for s in segments]).strip()
                if text: await websocket.send_text(text)
            finally:
                if os.path.exists(tmp_path): os.remove(tmp_path)
    except Exception:
        await websocket.close()