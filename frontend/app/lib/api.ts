// frontend/app/lib/api.ts

// 1. Standard Node Backend (Auth, Saving Notes)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// 2. New Python AI Backend (RAG, Transcription)
export const ML_API_BASE = process.env.NEXT_PUBLIC_ML_API_URL;

// --- Existing Node API Fetcher ---
export async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // cookies for auth
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

export async function mlFetch(path: string, options?: RequestInit) {
  return fetch(`${ML_API_BASE}${path}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

export const askDoubt = async (question: string) => {
  const response = await mlFetch("/rag/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });

  if (!response.ok) throw new Error("Failed to ask doubt");
  const data = await response.json();
  return data.answer; // Returns string from Qwen
};

export const summarizeYoutube = async (url: string) => {
  const response = await mlFetch("/youtube_summarize", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) throw new Error("YouTube processing failed");
  return await response.json(); // Returns { transcript, notes, image_url }
};

// 3. PDF Summarizer
export const summarizePdf = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  // Note: We use standard fetch here because FormData sets its own Content-Type
  const response = await fetch(`${ML_API_BASE}/pdf_summarize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("PDF processing failed");
  return await response.json(); // Returns { summary_markdown }
};