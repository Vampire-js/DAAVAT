"use client";

import React, { useState, useEffect } from "react";
import { useNote } from "@/app/contexts/NotesContext"; 
import { Send, Bot, User, Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askDoubt } from "@/app/lib/api";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function RagDoubtSolver() {
  const { content } = useNote(); 
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Default to collapsed so it doesn't block view initially
  const [isMinimized, setIsMinimized] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false); 

  const extractTextFromBlocks = (jsonString: string) => {
    try {
      if (!jsonString) return "";
      const blocks = JSON.parse(jsonString);
      if (!Array.isArray(blocks)) return jsonString;
      
      return blocks.map((block: any) => {
        if (Array.isArray(block.content)) {
            return block.content.map((c: any) => c.text || "").join(" ");
        }
        return "";
      }).join("\n");
    } catch {
      return jsonString || ""; 
    }
  };

  useEffect(() => {
    const ingestNote = async () => {
      if (!content) return;
      
      const plainText = extractTextFromBlocks(content);
      if (plainText.length < 50) return; 

      setIsIndexing(true);
      try {
        await fetch(`${process.env.NEXT_PUBLIC_ML_API_URL}rag/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: plainText }),
        });
        console.log("✅ AI context updated with current note.");
      } catch (err) {
        console.error("Failed to index note:", err);
      } finally {
        setIsIndexing(false);
      }
    };

    const timer = setTimeout(() => {
        ingestNote();
    }, 2000);

    return () => clearTimeout(timer);
  }, [content]);

  const handleAsk = async () => {
    if (!query.trim()) return;

    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);

    try {
      const answer = await askDoubt(userMessage.content);
      const aiMessage: Message = { role: "ai", content: answer };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Error connecting to the Tutor. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // STYLE MATCH: Used exact same classes as QuizGenerator
  return (
    <div 
      className={`w-full flex flex-col bg-[#0a0a0a]/95 backdrop-blur-md text-white transition-all duration-300 rounded-xl border border-neutral-800 shadow-2xl ${isMinimized ? 'h-auto' : 'h-[500px]'}`}
    >
      {/* Header - Matching QuizGenerator Style */}
      <div 
        className="p-3 bg-neutral-900/80 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800/80 transition-colors flex items-center justify-between rounded-t-xl"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
            {/* Icon Wrapper matching QuizGenerator */}
            <div className="p-1.5 bg-neutral-800 text-indigo-400 rounded-lg border border-neutral-700">
                <Bot className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                  AI Doubt Solver
                  {isIndexing && (
                    <span className="flex items-center gap-1 text-xs font-normal text-indigo-400 ml-2 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="hidden sm:inline">Reading...</span>
                    </span>
                  )}
                </h3>
            </div>
        </div>
        
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-neutral-400 hover:text-white hover:bg-neutral-700">
            {isMinimized ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </div>
      
      {!isMinimized && (
        <div className="p-4 flex-1 flex flex-col min-h-0 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 mb-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-neutral-500 py-10 italic flex flex-col items-center gap-2">
                <Bot className="w-8 h-8 opacity-20" />
                <p>I'm reading your note.<br/>Ask me anything about it!</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-600" : "bg-neutral-700"}`}>
                  {msg.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`p-3 rounded-lg text-sm max-w-[85%] shadow-sm ${msg.role === "user" ? "bg-indigo-900/40 text-indigo-100 border border-indigo-800" : "bg-neutral-900 text-neutral-200 border border-neutral-800"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                 </div>
                 <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                 </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0 pt-2 border-t border-neutral-800">
            <Input
              placeholder="Ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              className="flex-1 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus:bg-black focus:border-indigo-500 transition-colors"
            />
            <Button onClick={handleAsk} disabled={isLoading || !query.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-transparent">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}