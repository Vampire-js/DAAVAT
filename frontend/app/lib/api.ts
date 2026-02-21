// frontend/app/lib/api.ts

// 1. Standard Node Backend (Auth, Saving Notes)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// 2. New Python AI Backend (RAG, Transcription)
export const ML_API_BASE = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

// --- Existing Node API Fetcher ---
export async function apiFetch(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // cookies for auth
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  // GLOBAL 401 INTERCEPTOR
  // Detects if the laptop woke up with an expired session or if the server restarted
  if (response.status === 401) {
    console.warn("Unauthorized request detected. Redirecting to login...");
    
    // Only redirect if we are in the browser and NOT already on the login/signup pages
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/signup") {
        window.location.href = "/login";
      }
    }
  }

  return response;
}

// --- New Python AI Fetcher ---
export async function mlFetch(path: string, options?: RequestInit) {
  return fetch(`${ML_API_BASE}${path}`, {
    ...options,
    // Note: Python backend must have CORSMiddleware configured for localhost:3000
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

// ------------------------------------------
// AI Feature Exports
// ------------------------------------------

// 1. Doubt Solver (RAG)
export const askDoubt = async (question: string) => {
  const response = await mlFetch("/rag/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });

  if (!response.ok) throw new Error("Failed to ask doubt");
  const data = await response.json();
  return data.answer; 
};

// 2. YouTube Summarizer
export const summarizeYoutube = async (url: string) => {
  const response = await mlFetch("/youtube_summarize", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) throw new Error("YouTube processing failed");
  return await response.json(); 
};

// 3. PDF Summarizer
export const summarizePdf = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  // FormData sets its own multi-part boundary, so we don't set Content-Type header here
  const response = await fetch(`${ML_API_BASE}/pdf_summarize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("PDF processing failed");
  return await response.json(); 
};

// Add this to frontend/app/lib/api.ts
export const generateMasterNote = async (links: string[], files: File[]) => {
  const formData = new FormData();
  formData.append("links", JSON.stringify(links));
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${ML_API_BASE}/generate_master_note`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Master note generation failed");
  return await response.json();
};