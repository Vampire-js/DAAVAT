"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNote } from "@/app/contexts/NotesContext"; 
import { Send, Bot, User, Loader2, X, Sparkles, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askDoubt } from "@/app/lib/api";
import { clsx } from "clsx";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function RagDoubtSolver() {
  // Updated destructuring to use correct context variable names
  const { content, selectedDocId, references } = useNote(); 
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false); 
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);

  const processedContentRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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

  // Synchronized Indexing logic triggered on document switch
  useEffect(() => {
    const ingestNote = async () => {
      if (!selectedDocId) return;

      const plainText = extractTextFromBlocks(content || "");
      const sourcesText = (references || [])
        .map(ref => `Source: ${ref.title}\n${ref.content}`)
        .join("\n\n");
      
      const combinedContext = `${plainText}\n\n${sourcesText}`;

      if (combinedContext.trim().length < 50) {
        setSampleQuestions([
          "Summarize this note",
          "List key takeaways",
          "Explain main concepts",
          "Create study guide",
          "Simplify content"
        ]);
        return;
      }

      setIsIndexing(true);
      try {
        const response = await fetch("http://localhost:8000/rag/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: combinedContext }),
        });

        if (!response.ok) throw new Error("Ingestion failed");
        
        console.log("✅ AI context updated for note:", selectedDocId);

        const questionPrompt = "Based on the provided text, generate 5 diverse and highly specific study questions. Make them context-aware. Keep them short and concise. Return ONLY the questions separated by newlines, no numbers or bullet points.";
        const questionsRaw = await askDoubt(questionPrompt);
        const questionsArray = questionsRaw
          .split("\n")
          .filter(q => q.trim().length > 0)
          .slice(0, 5);

        setSampleQuestions(questionsArray.length > 0 ? questionsArray : [
          "Summarize this note",
          "List key takeaways",
          "Explain main concepts",
          "Create study guide",
          "Simplify content"
        ]);

        processedContentRef.current = content || null; 
        setMessages([]); 

      } catch (err) {
        console.error("❌ Failed to index note:", err);
      } finally {
        setIsIndexing(false);
      }
    };

    if (selectedDocId) {
      setMessages([]); 
      const timer = setTimeout(() => {
          ingestNote();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [selectedDocId, content, references]);

  const handleAsk = async (text?: string) => {
    const messageText = text || query.trim();
    if (!messageText) return;
    if (!isExpanded) setIsExpanded(true);

    const userMessage: Message = { role: "user", content: messageText };
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

  return (
    <>
      {!isExpanded && (
        <div className="relative group transition-all duration-300 transform hover:-translate-y-1 pointer-events-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center bg-neutral-900/90 border border-neutral-800 rounded-full px-4 py-1 shadow-2xl">
            <Sparkles className={clsx("ml-2 w-4 h-4 text-indigo-400", isIndexing && "animate-pulse")} />
            <Input
              ref={inputRef}
              placeholder={isIndexing ? "AI is reading..." : "Ask your AI Tutor anything..."}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.length > 0) setIsExpanded(true);
              }}
              onFocus={() => setIsExpanded(true)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              className="border-none bg-transparent focus-visible:ring-0 text-neutral-200 placeholder:text-neutral-500 h-12 text-base"
            />
            <Button 
              size="icon" 
              onClick={() => handleAsk()}
              className="rounded-full bg-neutral-800 hover:bg-indigo-600 w-10 h-10 shrink-0 transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-500">
          <div 
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-2xl pointer-events-auto" 
            onClick={() => setIsExpanded(false)} 
          />
          
          <div className="relative w-full max-w-5xl h-[85vh] flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl">
                  <Bot className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">AI Doubt Solver</h3>
                  <p className="text-xs text-neutral-400">Contextual Tutor</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExpanded(false)}
                className="rounded-full hover:bg-white/10 text-neutral-400 h-12 w-12"
              >
                <X className="w-8 h-8" />
              </Button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 md:px-12 space-y-8 custom-scrollbar pb-12"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Sparkles className="w-16 h-16 mb-4 text-indigo-500 opacity-30" />
                  <p className="text-2xl font-light text-white mb-8 opacity-30">What can I clarify for you today?</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                    {sampleQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleAsk(q)}
                        className="flex items-center gap-3 text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all text-neutral-300 hover:text-white group"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={clsx("flex gap-6 animate-in slide-in-from-bottom-4 duration-500", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                    msg.role === "user" ? "bg-indigo-600 border-indigo-500" : "bg-neutral-800 border-neutral-700"
                  )}>
                    {msg.role === "user" ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
                  </div>
                  <div className={clsx(
                    "p-6 rounded-3xl text-lg max-w-[80%] leading-relaxed shadow-2xl",
                    msg.role === "user" 
                      ? "bg-indigo-900/30 text-indigo-50 border border-indigo-500/20" 
                      : "bg-white/5 text-neutral-200 border border-white/10 backdrop-blur-md"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-6 animate-pulse">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl h-20 w-32 flex items-center justify-center">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 md:px-12 py-8 mt-auto">
              <div className="relative max-w-4xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25"></div>
                <div className="relative flex gap-4 bg-neutral-900 border border-white/10 p-2 rounded-2xl shadow-2xl">
                  <Input
                    ref={inputRef}
                    autoFocus
                    placeholder="Continue the conversation..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                    className="h-16 bg-transparent border-none text-xl focus-visible:ring-0 px-6 text-white placeholder:text-neutral-500"
                  />
                  <Button 
                    onClick={() => handleAsk()} 
                    disabled={isLoading || !query.trim()} 
                    className="h-16 w-16 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95"
                  >
                    <Send className="w-6 h-6 text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}