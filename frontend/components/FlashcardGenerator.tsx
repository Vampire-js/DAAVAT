// frontend/components/FlashcardGenerator.tsx
"use client";

import { useState } from "react";
import { useNote } from "@/app/contexts/NotesContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Layers, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import clsx from "clsx";

type Flashcard = {
  front: string;
  back: string;
};

export default function FlashcardGenerator({ isPopup = false }: { isPopup?: boolean }) {
  const { content, references } = useNote();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setCards(null);
    setCurrentIndex(0);
    setIsFlipped(false);

    // Combine Note + Sources context
    const noteText = content || ""; 
    const sourcesText = (references || [])
      .map(ref => `Source ${ref.title}: ${ref.content}`)
      .join("\n\n");
    const context = `${noteText}\n\n${sourcesText}`;

    try {
      const res = await fetch("http://localhost:8000/generate_flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: context }),
      });
      const data = await res.json();
      setCards(data.flashcards);
    } catch (err) {
      console.error("Flashcard generation failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx(
      "w-full flex flex-col bg-[#0a0a0a]/95 text-white transition-all duration-300",
      isPopup ? "h-[80vh]" : "h-[500px]"
    )}>
      {/* Header */}
      <div className="p-4 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white">Smart Flashcards</h3>
        </div>
        <Button onClick={handleGenerate} disabled={loading} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (cards ? "Regenerate" : "Generate Cards")}
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 overflow-y-auto custom-scrollbar">
        {cards ? (
          <>
            {/* Flashcard with 3D Flip Logic */}
            <div 
              className="relative w-full max-w-sm aspect-[4/3] cursor-pointer perspective-1000 group"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={clsx(
                "relative w-full h-full transition-transform duration-700 transform-style-3d",
                isFlipped && "rotate-y-180"
              )}>
                
                {/* FRONT FACE */}
                <Card className="absolute inset-0 backface-hidden bg-neutral-900 border-neutral-800 flex items-center justify-center p-8 text-center shadow-xl">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em]">Question</span>
                    <p className="text-xl font-medium text-neutral-200 leading-relaxed">
                      {cards[currentIndex].front}
                    </p>
                  </div>
                  <span className="absolute bottom-4 text-[10px] uppercase tracking-widest text-neutral-500 opacity-50 group-hover:opacity-100 transition-opacity">
                    Click to reveal answer
                  </span>
                </Card>

                {/* BACK FACE */}
                <Card className="absolute inset-0 backface-hidden rotate-y-180 bg-neutral-800 border-emerald-500/30 flex items-center justify-center p-8 text-center shadow-xl">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em]">Answer</span>
                    <p className="text-lg text-neutral-100 italic leading-relaxed">
                      {cards[currentIndex].back}
                    </p>
                  </div>
                </Card>

              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                disabled={currentIndex === 0} 
                onClick={() => { setCurrentIndex(prev => prev - 1); setIsFlipped(false); }}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <span className="text-sm font-mono text-neutral-500">{currentIndex + 1} / {cards.length}</span>
              <Button 
                variant="ghost" 
                disabled={currentIndex === cards.length - 1} 
                onClick={() => { setCurrentIndex(prev => prev + 1); setIsFlipped(false); }}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center opacity-40 italic">
            <Layers className="w-12 h-12 mx-auto mb-4" />
            <p>Generate cards to start your study session.</p>
          </div>
        )}
      </div>
    </div>
  );
}