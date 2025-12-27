import express from 'express';
import dotenv from 'dotenv';
import { requireAuth } from '../middleware/auth.js';
import { Document } from '../models/Document.js';

dotenv.config();
const router = express.Router();

router.use(requireAuth);

// --- 1. GET ALL DOCUMENTS (Crucial for the 404 Fix) ---
router.get("/documents", async (req, res) => {
  try {
    const userID = req.user.id;
    // Fetch all documents (folders and notes) for the user
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
    const userID = req.user.id;

    const folder = await Document.create({
      name,
      parentId: parentId || null,
      order: order || Date.now(),
      type: "folder",
      userId: userID,
    });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ msg: "Error creating folder" });
  }
});

// --- 3. ADD NOTE ---
router.post("/addNote", async (req, res) => {
  try {
    const { name, parentId, content, order } = req.body;
    const userID = req.user.id;

    const note = await Document.create({
      name,
      parentId: parentId || null,
      content: content || "",
      order: order || Date.now(),
      type: "note",
      userId: userID,
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ msg: "Error creating note" });
  }
});

// --- 4. GET NOTE CONTENT ---
router.post("/getNoteById", async (req, res) => {
  try {
    const note = await Document.findOne({ _id: req.body.noteID, userId: req.user.id });
    if (!note) return res.status(404).json({ msg: "Note not found" });
    res.json(note);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching note" });
  }
});

// --- 5. UPDATE NOTE ---
router.post("/updateNote", async (req, res) => {
  try {
    const note = await Document.findOneAndUpdate(
      { _id: req.body.noteID, userId: req.user.id },
      { content: req.body.content },
      { new: true }
    );
    res.json(note);
  } catch (err) {
    res.status(500).json({ msg: "Error updating note" });
  }
});

export default router;