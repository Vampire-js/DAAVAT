import express from 'express';
import dotenv from 'dotenv';
import { requireAuth } from '../middleware/auth.js';
import { Document } from '../models/Document.js'; 

dotenv.config();
const router = express.Router();

// Protect all routes in this file
router.use(requireAuth);

// --- 1. GET ALL DOCUMENTS ---
router.get("/documents", async (req, res) => {
  try {
    const userID = req.user.id;
    const docs = await Document.find({ userId: userID }).sort({ order: 1 });
    res.json(docs);
  } catch (err) {
    console.error("GET Documents Error:", err);
    res.status(500).json({ msg: "Error fetching documents" });
  }
});

// --- 2. ADD FOLDER ---
router.post("/addFolder", async (req, res) => {
  try {
    const { name, parentId, order } = req.body;
    const folder = await Document.create({
      name,
      parentId: parentId || null,
      order: order || Date.now(),
      type: "folder",
      userId: req.user.id,
    });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ msg: "Error creating folder" });
  }
});

// --- 3. ADD NOTE ---
router.post("/addNote", async (req, res) => {
  try {
    const { name, parentId, content, order, references } = req.body; 
    
    const note = await Document.create({
      name,
      parentId: parentId || null,
      content: content || "",
      order: order || Date.now(),
      type: "note",
      userId: req.user.id,
      references: references || [] 
    });
    
    res.status(201).json(note);
  } catch (err) {
    console.error("Add Note Error:", err);
    res.status(500).json({ msg: "Error creating note" });
  }
});

// --- 4. GET NOTE CONTENT ---
router.post("/getNoteById", async (req, res) => {
  try {
    const { noteID } = req.body;
    const note = await Document.findOne({ _id: noteID, userId: req.user.id });
    if (!note) return res.status(404).json({ msg: "Note not found" });
    res.json([note]); 
  } catch (err) {
    res.status(500).json({ msg: "Error fetching note" });
  }
});

// --- 5. UPDATE NOTE CONTENT ---
router.post("/updateNote", async (req, res) => {
  try {
    const { noteID, content, references } = req.body; 
    
    const note = await Document.findOneAndUpdate(
      { _id: noteID, userId: req.user.id },
      { 
        content: content,
        references: references 
      },
      { new: true }
    );

    if (!note) return res.status(404).json({ msg: "Note not found" });
    res.json(note);
  } catch (err) {
    console.error("Update Note Error:", err);
    res.status(500).json({ msg: "Error updating note" });
  }
});

// --- 6. RENAME ITEM (Unified logic for frontend call) ---
router.post("/renameItem", async (req, res) => {
  const { id, newName } = req.body; // Frontend sends 'id' and 'newName'
  
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: id, userId: req.user.id }, // Security: ensure user owns the doc
      { name: newName },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }
    
    res.status(200).json(doc);
  } catch (error) {
    console.error("Rename Error:", error);
    res.status(500).json({ error: "Failed to rename item" });
  }
});

// --- 7. DELETE DOCUMENT ---
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await Document.findOneAndDelete({ _id: id, userId: req.user.id });
    res.json({ msg: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting document" });
  }
});

export default router;