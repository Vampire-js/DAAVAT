import { API_BASE } from "./api";

const FASTAPI_FALLBACK = process.env.NEXT_PUBLIC_TRANSCRIBE_URL || "http://127.0.0.1:8000/transcribe_and_summarize";

export async function transcribeFile(file: File) {
  const form = new FormData();
  form.append("file", file);

  // Try proxy on our API server first
  const proxyUrl = `${API_BASE}/transcribe`;
  try {
    let res = await fetch(proxyUrl, {
      method: "POST",
      body: form,
      credentials: "include",
    });

    // If proxy isn't available (404), fall back to direct FastAPI
    if (res.status === 404) {
      try {
        res = await fetch(FASTAPI_FALLBACK, {
          method: "POST",
          body: form,
        });
      } catch (err) {
        throw new Error(`Failed to reach FastAPI fallback (${FASTAPI_FALLBACK}): ${err}`);
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Transcription failed: ${res.status} ${res.statusText} ${text}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    throw err;
  }
}
