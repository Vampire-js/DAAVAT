"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";

interface GraphProps {
    setSelected: (value: "notes" | "graph") => void;
}

export function Graph({ setSelected }: GraphProps) {
    const { setSelectedDocId } = useNote();   // ✅ updated
    const containerRef = useRef<HTMLDivElement>(null);
    const [notes, setNotes] = useState<any[]>([]);

    useEffect(() => {
        apiFetch("/fileTree/documents")
            .then(res => res.json())
            .then(data => {
                const onlyNotes = data.filter(
                    (doc: any) => doc.type === "note"
                );
                setNotes(onlyNotes);
            });
    }, []);

    useEffect(() => {
        if (!containerRef.current || notes.length === 0) return;

        const elements = notes.map(note => ({
            data: {
                id: note._id,
                label: note.name,
            }
        }));

        const cy = cytoscape({
            container: containerRef.current,
            elements,
            zoom: 0.1,
            minZoom: 0.1,
            maxZoom: 3,

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
                        "text-halign": "center",
                        "text-margin-y": 6,
                    },
                },
                {
                    selector: "edge",
                    style: {
                        "width": 1,
                        "line-color": "#555",
                    },
                },
            ],

            layout: {
                name: "cose",
                animate: true,
                fit: true,
                padding: 100,
            },
        });

        // 🔥 Node click → switch to notes view
        cy.on("tap", "node", (event) => {
            const nodeId = event.target.id();

            setSelectedDocId(nodeId);  // ✅ correct
            setSelected("notes");
        });

        return () => {
            cy.destroy();
        };
    }, [notes, setSelectedDocId, setSelected]);

    return (
        <div className="w-full h-full bg-[#0f0f0f]">
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}