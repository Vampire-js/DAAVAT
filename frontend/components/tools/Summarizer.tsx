"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react"; 
import { useNote } from "@/app/contexts/NotesContext"; // Added for Source Cards

type ApiResponse = {
  transcript: string;
  summary: string[];
};

type ModelSize = "small" | "medium" | "large";

export default function Summarizer() {
  const { addReference } = useNote(); // Accessing reference helper
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [modelSize, setModelSize] = useState<ModelSize>("medium");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.type !== "audio/mpeg") {
      alert("Please upload an MP3 file");
      return;
    }
    setAudioFile(file);
    setResult(null); 
  };

  const sendToAPI = async () => {
    if (!audioFile) return;

    setLoading(true); 
    setResult(null);

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model_size", modelSize);

    try {
      const res = await fetch("http://127.0.0.1:8000/transcribe_and_summarize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setResult(data as ApiResponse);
    } catch (err) {
      console.error("Transcription failed:", err);
      alert("Failed to connect to the summarizer. Make sure the Python backend is running.");
    } finally {
      setLoading(false); 
    }
  };

  // Logic to inject summary into the Source Cards at the bottom of the editor
  const handleAddToNote = () => {
    if (!result) return;
    addReference({
      source: "Audio",
      title: audioFile?.name || "Audio File",
      content: result.summary.join("\n")
    });
    alert("Audio summary added to references!");
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-5 text-sm text-neutral-300">
      <h2 className="font-semibold text-lg text-white">Audio Summarizer</h2>
      <p className="text-neutral-400">
        Upload an MP3 file to generate a summary or ask questions.
      </p>

      {/* Model Slider */}
      <div className="flex flex-col gap-2 p-3 border border-neutral-800 rounded-md bg-neutral-900/50">
        <label className="text-xs font-medium text-neutral-400">Model Size: <span className="text-indigo-400 font-bold uppercase">{modelSize}</span></label>
        <input 
            type="range" 
            min="0" 
            max="2" 
            step="1" 
            value={modelSize === "small" ? 0 : modelSize === "medium" ? 1 : 2}
            onChange={(e) => {
                const val = parseInt(e.target.value);
                setModelSize(val === 0 ? "small" : val === 1 ? "medium" : "large");
            }}
            className="w-full accent-indigo-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
            <span>Small (Fast)</span>
            <span>Medium (Balanced)</span>
            <span>Large (Accurate)</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          {audioFile ? "Change Audio" : "Upload MP3"}
        </Button>
        {audioFile && <span className="self-center text-xs truncate max-w-[150px]">{audioFile.name}</span>}
      </div>

      <Button
        disabled={!audioFile || loading}
        onClick={sendToAPI}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Generate Summary"
        )}
      </Button>

      {/* ================= RESULT ================= */}
      {result && (
        <div className="space-y-4 border border-neutral-800 rounded-lg p-4 bg-neutral-900 mt-4">
          
          {/* Transcript */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Transcript</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(result.transcript)}
              >
                Copy
              </Button>
            </div>
            <p className="text-neutral-400 leading-relaxed max-h-60 overflow-y-auto">
              {result.transcript}
            </p>
          </div>

          {/* Summary Section with new Add to References button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Summary</h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddToNote}
                  className="border-indigo-500 text-indigo-500 hover:bg-indigo-500/10 text-xs h-8"
                >
                  Add to References
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(result.summary.join("\n"))}
                  className="text-xs h-8"
                >
                  Copy
                </Button>
              </div>
            </div>

            <ul className="list-disc list-inside space-y-1 text-neutral-300">
              {result.summary.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}