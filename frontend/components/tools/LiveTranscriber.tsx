"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, CheckCircle2, Copy } from "lucide-react";

type FinalResult = {
  transcript: string;
  summary: string[];
};

type ModelSize = "small" | "medium" | "large";

export default function LiveTranscriber() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelSize, setModelSize] = useState<ModelSize>("small");
  
  // Live Stream State
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  
  // Final Result State
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Recorders
  const chunkRecorderRef = useRef<MediaRecorder | null>(null); // For Live
  const fullRecorderRef = useRef<MediaRecorder | null>(null);  // For Final Upload
  const fullAudioChunksRef = useRef<Blob[]>([]); // Store full audio here

  useEffect(() => {
  return () => {
    stopLiveCapture().catch(console.error);
  };
}, []);


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const startLiveCapture = async () => {
    try {
      setLiveTranscript([]);
      setFinalResult(null);
      fullAudioChunksRef.current = []; // Reset full audio buffer

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (stream.getAudioTracks().length === 0) {
        alert("No audio found! Please check 'Also share tab audio'.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const audioStream = new MediaStream(stream.getAudioTracks());

      // -------------------------------
      // 1. Setup LIVE Stream (WebSocket) with Model Param
      // -------------------------------
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/live_transcribe?model_size=${modelSize}`);
      ws.onopen = () => {
        console.log("Connected to Live Transcriber");
        setIsRecording(true);
        startChunkRecording(audioStream, ws);
      };
      ws.onmessage = (event) => setLiveTranscript((prev) => [...prev, event.data]);
      ws.onerror = (err) => console.error("WebSocket error", err);
      socketRef.current = ws;

      // -------------------------------
      // 2. Setup FULL Recorder (For Summary)
      // -------------------------------
      const fullRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
      fullRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) fullAudioChunksRef.current.push(e.data);
      };
      fullRecorder.start();
      fullRecorderRef.current = fullRecorder;

      // Handle "Stop Sharing" from Browser UI
      stream.getVideoTracks()[0].onended = () => stopLiveCapture();

    } catch (err) {
      console.error("Error starting capture:", err);
    }
  };

  const startChunkRecording = (stream: MediaStream, ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunkRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    recorder.onstop = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        startChunkRecording(stream, ws);
      }
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 1000); // 1-second chunks for live preview
  };

  const stopLiveCapture = async () => {
    // Stop Live Recorders
    if (chunkRecorderRef.current && chunkRecorderRef.current.state !== "inactive") {
      chunkRecorderRef.current.onstop = null;
      chunkRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    // Stop Full Recorder
    if (fullRecorderRef.current && fullRecorderRef.current.state !== "inactive") {
      fullRecorderRef.current.stop();
      // Wait a moment for the last chunk to be pushed
      await new Promise(resolve => setTimeout(resolve, 500));
      generateFinalSummary(); 
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const generateFinalSummary = async () => {
    if (fullAudioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    try {
      const fullBlob = new Blob(fullAudioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", fullBlob, "meeting_recording.webm");
      formData.append("model_size", modelSize); // Use same model for final summary

      const res = await fetch("http://127.0.0.1:8000/transcribe_and_summarize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to generate summary");

      const data = await res.json();
      setFinalResult(data);

    } catch (err) {
      console.error("Final processing failed:", err);
      alert("Could not generate final summary.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 text-sm text-neutral-300">
      <h2 className="font-semibold text-lg text-white">Live Meeting Transcript</h2>
      <p className="text-neutral-400">
        Records live, then generates a <strong>high-quality summary</strong> when you stop.
      </p>

      {/* Model Slider */}
      <div className="flex flex-col gap-2 p-3 border border-neutral-800 rounded-md bg-neutral-900/50">
        <label className="text-xs font-medium text-neutral-400">Model Size: <span className="text-green-400 font-bold uppercase">{modelSize}</span></label>
        <input 
            type="range" 
            min="0" 
            max="2" 
            step="1" 
            disabled={isRecording}
            value={modelSize === "small" ? 0 : modelSize === "medium" ? 1 : 2}
            onChange={(e) => {
                const val = parseInt(e.target.value);
                setModelSize(val === 0 ? "small" : val === 1 ? "medium" : "large");
            }}
            className="w-full accent-green-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
            <span>Small (Fast)</span>
            <span>Medium (Balanced)</span>
            <span>Large (Accurate)</span>
        </div>
      </div>

      <div className="flex gap-2">
        {!isRecording && !isProcessing ? (
          <Button onClick={startLiveCapture} className="bg-green-600 hover:bg-green-700 text-white w-full">
            <Mic className="mr-2 h-4 w-4" /> Start Recording
          </Button>
        ) : isRecording ? (
          <Button onClick={stopLiveCapture} variant="destructive" className="w-full">
            <Square className="mr-2 h-4 w-4" /> Stop & Summarize
          </Button>
        ) : (
          <Button disabled className="w-full bg-neutral-700 text-neutral-400 cursor-not-allowed">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Final Transcript...
          </Button>
        )}
      </div>

      {/* FINAL RESULT UI */}
      {finalResult ? (
        <div className="border border-green-900 bg-green-950/30 rounded-md p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-green-400 font-semibold border-b border-green-900 pb-2">
            <CheckCircle2 size={16} /> Meeting Summary (High Quality)
          </div>
          
          <div className="space-y-2">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-400 uppercase">Summary Points</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-neutral-400 hover:text-white"
                  onClick={() => copyToClipboard(finalResult.summary.join("\n"))}
                >
                  <Copy size={12} className="mr-1" /> Copy
                </Button>
             </div>
             <ul className="list-disc list-inside space-y-1 text-neutral-300">
              {finalResult.summary.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 pt-2">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-400 uppercase">Full Transcript</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-neutral-400 hover:text-white"
                  onClick={() => copyToClipboard(finalResult.transcript)}
                >
                  <Copy size={12} className="mr-1" /> Copy
                </Button>
             </div>
             <p className="text-neutral-400 text-xs leading-relaxed max-h-40 overflow-y-auto">
               {finalResult.transcript}
             </p>
          </div>
        </div>
      ) : (
        /* LIVE PREVIEW UI */
        <div className="h-64 overflow-y-auto border border-neutral-800 bg-neutral-900 rounded-md p-4 space-y-2 font-mono text-xs">
          {liveTranscript.length === 0 ? (
            <span className="text-neutral-500 italic">Waiting for audio...</span>
          ) : (
            liveTranscript.map((text, i) => (
              <p key={i} className="text-green-400 border-b border-neutral-800 pb-1">
                {text}
              </p>
            ))
          )}
          {isRecording && <div className="animate-pulse text-green-700">Listening...</div>}
        </div>
      )}
    </div>
  );
}