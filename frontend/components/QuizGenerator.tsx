"use client";

import { useState } from "react";
import { useNote } from "@/app/contexts/NotesContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";

type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export default function QuizGenerator() {
  const { content } = useNote();
  const [quizData, setQuizData] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  
  // Default collapsed
  const [isMinimized, setIsMinimized] = useState(true);

  const extractTextFromBlocks = (jsonString: string) => {
    try {
      const blocks = JSON.parse(jsonString);
      if (!Array.isArray(blocks)) return jsonString;
      return blocks.map((block: any) => {
        if (Array.isArray(block.content)) return block.content.map((c: any) => c.text || "").join(" ");
        return "";
      }).join("\n");
    } catch {
      return jsonString || ""; 
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setQuizData(null);
    setSubmitted(false);
    setUserAnswers({});

    const plainText = extractTextFromBlocks(content || "");
    if (!plainText || plainText.trim().length < 50) {
        setError("Note is too short. Please write more content first.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ML_API_URL}/generate_quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: plainText, num_questions: 3 }),
      });
      if (!res.ok) throw new Error("Failed to generate quiz");
      const data = await res.json();
      setQuizData(data.quiz);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to AI service. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = () => {
    if (!quizData) return 0;
    let score = 0;
    quizData.forEach((q, idx) => {
        if (userAnswers[idx] === q.answer) score++;
    });
    return score;
  };

  return (
    <div className={`w-full flex flex-col bg-[#0a0a0a]/95 backdrop-blur-md text-white transition-all duration-300 rounded-xl border border-neutral-800 shadow-2xl ${isMinimized ? 'h-auto' : 'h-[500px]'}`}>
      
      {/* Header Card (Clickable to Collapse) */}
      <div 
        className="p-3 bg-neutral-900/80 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800/80 transition-colors flex items-center justify-between rounded-t-xl"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
            <div className="p-1.5 bg-neutral-800 text-indigo-400 rounded-lg border border-neutral-700">
                <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-white text-sm md:text-base">Quiz Me</h3>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {!isMinimized && (
                <Button 
                    onClick={(e) => { e.stopPropagation(); handleGenerate(); }} 
                    disabled={loading} 
                    size="sm" 
                    className={`h-7 text-xs border border-transparent ${
                        quizData 
                            ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white" 
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (quizData ? "New Quiz" : "Start Quiz")}
                </Button>
            )}
            
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-neutral-400 hover:text-white hover:bg-neutral-700">
                {isMinimized ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
        </div>
      </div>

      {/* Quiz Content */}
      {!isMinimized && (
        <div className="p-1 flex-1 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 flex flex-col">
            {error && <p className="text-xs text-rose-400 m-4 font-medium bg-rose-950/30 p-2 rounded border border-rose-900/50">{error}</p>}

            {quizData && (
                <div className="space-y-4 p-4 pb-20">
                {quizData.map((q, qIdx) => (
                    <Card key={qIdx} className="p-5 bg-neutral-900 border border-neutral-800 shadow-sm">
                    <p className="font-semibold text-base mb-4 text-neutral-200 leading-snug">
                        <span className="text-indigo-400 mr-2">#{qIdx + 1}</span>
                        {q.question}
                    </p>
                    
                    <div className="space-y-3">
                        {q.options.map((opt, oIdx) => {
                        const isSelected = userAnswers[qIdx] === oIdx;
                        const isCorrect = q.answer === oIdx;
                        const showResult = submitted;
                        let styles = "w-full justify-start text-left h-auto py-3 px-4 text-base whitespace-normal transition-all border shadow-sm ";
                        if (showResult) {
                            if (isCorrect) styles += "bg-emerald-950/40 border-emerald-800 text-emerald-300 ring-1 ring-emerald-900";
                            else if (isSelected && !isCorrect) styles += "bg-rose-950/40 border-rose-800 text-rose-300 ring-1 ring-rose-900";
                            else styles += "opacity-50 bg-neutral-900 text-neutral-500 border-neutral-800";
                        } else {
                            if (isSelected) styles += "bg-indigo-950/40 border-indigo-800 text-indigo-100 ring-1 ring-indigo-900";
                            else styles += "bg-black hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:border-neutral-700";
                        }
                        return (
                            <Button key={oIdx} variant="ghost" className={styles} onClick={() => !submitted && setUserAnswers(prev => ({...prev, [qIdx]: oIdx}))}>
                            <span className={`mr-3 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isSelected || (showResult && isCorrect) ? "bg-white/20 text-white" : "bg-neutral-800 text-neutral-400"}`}>
                                {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="leading-relaxed">{opt}</span>
                            </Button>
                        );
                        })}
                    </div>
                    {submitted && (
                        <div className="mt-4 text-sm bg-blue-950/20 text-blue-200 p-4 rounded-lg border border-blue-900/50">
                            <strong className="block mb-1 font-semibold text-blue-400">💡 Explanation</strong> 
                            <span className="leading-relaxed opacity-90">{q.explanation}</span>
                        </div>
                    )}
                    </Card>
                ))}
                
                {/* Fixed Footer for Actions inside the scroll area */}
                <div className="pt-4 pb-2">
                    {!submitted ? (
                        <Button onClick={() => setSubmitted(true)} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md" disabled={Object.keys(userAnswers).length !== quizData.length}>
                            Submit Answers
                        </Button>
                    ) : (
                        <div className="flex gap-3 items-center bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                            <div className="flex-1 py-2 px-4 bg-neutral-800 rounded-lg text-center text-sm font-bold text-neutral-300">
                                Score: <span className="text-lg text-indigo-400 ml-1">{calculateScore()} / {quizData.length}</span>
                            </div>
                            <Button variant="outline" onClick={handleGenerate} className="border-neutral-700 hover:bg-neutral-800 text-neutral-300">Try Again</Button>
                        </div>
                    )}
                </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}