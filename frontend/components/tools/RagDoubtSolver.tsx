"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNote } from "@/app/contexts/NotesContext"; 
import { Send, Bot, User, X, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askDoubt } from "@/app/lib/api";
import { clsx } from "clsx";

interface Message {
  role: "user" | "ai";
  content: string;
}

// Simple Linear 3-Dot Loading Animation
const ThreeDotLoader = () => (
  <div className="flex gap-1.5 items-center justify-center">
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-duration:0.8s]"></div>
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></div>
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></div>
  </div>
);

export function RagDoubtSolver() {
  const { content, selectedNoteId, references } = useNote(); 
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false); 
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const ingestNote = async () => {
      const plainText = extractTextFromBlocks(content || "");
      const sourcesText = (references || [])
        .map(ref => `Source: ${ref.title}\n${ref.content}`)
        .join("\n\n");
      const combinedContext = `${plainText}\n\n${sourcesText}`;

      if (combinedContext.trim().length < 50) {
        setSampleQuestions(["Summarize this note", "List key takeaways", "Explain main concepts", "Create study guide", "Simplify content"]);
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
        
        const questionPrompt = "Generate 5 specific study questions based on the text. Return ONLY the questions separated by newlines.";
        const questionsRaw = await askDoubt(questionPrompt);
        const questionsArray = questionsRaw.split("\n").filter(q => q.trim().length > 0).slice(0, 5);
        setSampleQuestions(questionsArray.length > 0 ? questionsArray : ["Summarize this note", "List key takeaways"]);
        setMessages([]); 
      } catch (err) {
        console.error("Failed to index note:", err);
      } finally {
        setIsIndexing(false);
      }
    };

    if (selectedNoteId) {
      setMessages([]); 
      const timer = setTimeout(() => ingestNote(), 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedNoteId, content, references]);

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
      setMessages((prev) => [...prev, { role: "ai", content: answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "⚠️ Error connecting to Chert." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isExpanded && (
        <div className="relative group transition-all duration-300 pointer-events-auto">
          {(isIndexing || isLoading) && (
            <div className="absolute -inset-10 flex items-center justify-center pointer-events-none z-0">
              <div className="w-32 h-32 rounded-full bg-primary/10 blur-2xl animate-vibrate" />
            </div>
          )}

          <div className="relative flex items-center bg-card/90 border border-border rounded-full px-4 py-1 shadow-2xl backdrop-blur-md">
            <div className="ml-2 flex items-center justify-center w-8 h-8">
              <Sparkles className={clsx("w-5 h-5 text-primary", isIndexing && "animate-pulse")} />
            </div>
            <Input
              ref={inputRef}
              placeholder={isIndexing ? "Chert is reading..." : "Ask Chert anything..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              className="border-none bg-transparent focus-visible:ring-0 text-foreground placeholder:text-muted-foreground h-12 text-base"
            />
            <Button size="icon" onClick={() => handleAsk()} className="rounded-full bg-primary hover:scale-105 w-10 h-10 transition-all">
              <Send className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-2xl pointer-events-auto" onClick={() => setIsExpanded(false)} />
          
          <div className="relative w-full max-w-5xl h-[85vh] flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center min-w-10 min-h-10">
                  <Sparkles className={clsx("w-6 h-6 text-primary", (isLoading || isIndexing) && "animate-pulse")} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground tracking-widest uppercase">Chert</h3>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="rounded-full hover:bg-accent text-muted-foreground h-12 w-12">
                <X className="w-8 h-8" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 space-y-8 custom-scrollbar pb-12">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Sparkles className="w-16 h-16 mb-4 text-primary opacity-20" />
                  <p className="text-2xl font-light text-foreground mb-8 opacity-40 italic">What can Chert clarify for you today?</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                    {sampleQuestions.map((q, i) => (
                      <button key={i} onClick={() => handleAsk(q)} className="flex items-center gap-3 text-left p-4 rounded-2xl bg-secondary/50 border border-border hover:bg-primary/10 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground">
                        <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
                        <span className="text-sm font-medium">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={clsx("flex gap-6 animate-in slide-in-from-bottom-2 duration-300", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border", msg.role === "user" ? "bg-primary border-primary shadow-lg" : "bg-muted border-border")}>
                    {msg.role === "user" ? <User className="w-6 h-6 text-primary-foreground" /> : <Bot className="w-6 h-6 text-foreground" />}
                  </div>
                  <div className={clsx("p-6 rounded-3xl text-lg max-w-[80%] leading-relaxed shadow-sm", msg.role === "user" ? "bg-primary/10 text-foreground border border-primary/20" : "bg-muted/50 text-foreground border border-border backdrop-blur-sm")}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-6 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <div className="p-4 px-6 bg-muted/50 border border-border rounded-full flex items-center justify-center">
                    <ThreeDotLoader />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 md:px-12 py-8 mt-auto">
              <div className="relative max-w-4xl mx-auto">
                <div className="relative flex gap-4 bg-card border border-border p-2 rounded-2xl shadow-2xl">
                  <Input ref={inputRef} autoFocus placeholder="Ask Chert to clarify or explain..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAsk()} className="h-16 bg-transparent border-none text-xl focus-visible:ring-0 px-6 text-foreground placeholder:text-muted-foreground" />
                  <Button onClick={() => handleAsk()} disabled={isLoading || !query.trim()} className="h-16 w-16 rounded-xl bg-primary hover:opacity-90 transition-all active:scale-95 shadow-lg">
                    <Send className="w-6 h-6 text-primary-foreground" />
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