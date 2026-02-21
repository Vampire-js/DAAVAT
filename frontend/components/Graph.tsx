"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { apiFetch, ML_API_BASE } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";

interface GraphProps {
    setSelected: (value: "notes" | "graph") => void;
}

export function Graph({ setSelected }: GraphProps) {
    const { setSelectedDocId } = useNote();
    const containerRef = useRef<HTMLDivElement>(null);
    const [elements, setElements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadGraphData = async () => {
            try {
                // 1. Fetch notes metadata
                const res = await apiFetch("/fileTree/documents");
                const data = await res.json();
                const onlyNotes = data.filter((doc: any) => doc.type === "note");

                if (onlyNotes.length === 0) return;

                // 2. Prepare nodes for Cytoscape
                const nodes = onlyNotes.map((note: any) => ({
                    data: { id: note._id, label: note.name }
                }));

                // 3. Request Semantic Edges from ML Backend
                const formData = new FormData();
                onlyNotes.forEach((note: any) => {
                    // Create a virtual file for each note's content
                    const blob = new Blob([note.content || ""], { type: "text/plain" });
                    formData.append("files", blob, `${note._id}.txt`);
                });

                const edgeRes = await fetch(`${ML_API_BASE}/documents/edges`, {
                    method: "POST",
                    body: formData
                });

                const edgeData = await edgeRes.json();
                
                // 4. Map edges for Cytoscape
                const edges = (edgeData.edges || []).map((edge: any) => ({
                    data: {
                        id: `edge-${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        weight: edge.similarity
                    }
                }));

                setElements([...nodes, ...edges]);
            } catch (err) {
                console.error("Failed to build graph edges:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadGraphData();
    }, []);

    useEffect(() => {
        if (!containerRef.current || elements.length === 0) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: elements,
            style: [
    {
        selector: "node",
        style: {
            "background-color": "#7c3aed",
            "width": 14,
            "height": 14,
            "label": "data(label)",
            "color": "#e5e5e5",
            "font-size": 10,
            "text-valign": "bottom",
            "text-margin-y": 4,
            "overlay-opacity": 0,
        },
    },
    {
        selector: "edge",
        style: {
            // Only show lines for edges that exist in the top-K list
            "width": "mapData(weight, 0.3, 1, 0.5, 4)", 
            "line-color": "#4f46e5",
            "opacity": "mapData(weight, 0.3, 1, 0.2, 0.8)", // Faded for weak, bright for strong
            "curve-style": "haystack", // Better performance for many edges
        },
    },
],
            layout: {
                name: "cose",
                animate: true,
                randomize: true,
                componentSpacing: 100,
                nodeRepulsion: () => 1000000,
                idealEdgeLength: () => 150,
                edgeElasticity: () => 100,
                gravity: 0.1,
            } as any,
        });

        cy.on("tap", "node", (event) => {
            setSelectedDocId(event.target.id());
            setSelected("notes");
        });

        return () => cy.destroy();
    }, [elements, setSelectedDocId, setSelected]);

    return (
        <div className="w-full h-full bg-[#0a0a0a] relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-xs uppercase tracking-widest bg-black/50 z-10">
                    Calculating Semantic Connections...
                </div>
            )}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}