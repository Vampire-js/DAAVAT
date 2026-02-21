"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Youtube, FileText, X } from "lucide-react";

export default function MagicDropModal() {
  const [items, setItems] = useState<{type: 'link' | 'file', value: any}[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const addItem = () => {
    if (inputValue.includes("youtube.com")) {
      setItems([...items, { type: 'link', value: inputValue }]);
    }
    setInputValue("");
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    const formData = new FormData();
    const links = items.filter(i => i.type === 'link').map(i => i.value);
    formData.append("links", JSON.stringify(links));
    
    // Append files from staging...
    
    const res = await fetch("http://localhost:8000/generate_master_note", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    console.log("Master Note:", data);
    setIsProcessing(false);
  };

  return (
    <Dialog>
      <DialogContent className="sm:max-w-[500px] bg-neutral-900 text-white">
        <DialogHeader>
          <DialogTitle>Magic Drop - Unified Loader</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Paste YouTube link or drag files..." 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)}
              className="bg-neutral-800 border-neutral-700"
            />
            <Button onClick={addItem} variant="secondary"><Plus className="w-4 h-4" /></Button>
          </div>

          <div className="min-h-[100px] border-2 border-dashed border-neutral-700 rounded-lg p-4">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-neutral-800 p-2 rounded mb-2">
                <div className="flex items-center gap-2">
                  {item.type === 'link' ? <Youtube className="text-red-500 w-4 h-4"/> : <FileText className="text-blue-500 w-4 h-4"/>}
                  <span className="text-xs truncate max-w-[200px]">{item.value}</span>
                </div>
                <X className="w-4 h-4 cursor-pointer" onClick={() => setItems(items.filter((_, i) => i !== idx))} />
              </div>
            ))}
          </div>

          <Button 
            className="w-full bg-orange-600 hover:bg-orange-700" 
            disabled={isProcessing || items.length === 0}
            onClick={handleProcess}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Process All & Synthesize"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}