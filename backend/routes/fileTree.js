import express from 'express';
import dotenv from 'dotenv';
import { requireAuth } from '../middleware/auth.js';
import { Document } from '../models/Document.js'; // Your project uses the Document model

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
    // 1. 🔥 Add 'references' to the destructuring here
    const { name, parentId, content, order, references } = req.body; 
    
    const note = await Document.create({
      name,
      parentId: parentId || null,
      content: content || "",
      order: order || Date.now(),
      type: "note",
      userId: req.user.id,
      // 2. 🔥 Save the references passed from the body
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
    // Ensure we fetch the note belonging to the authenticated user
    const note = await Document.findOne({ _id: noteID, userId: req.user.id });
    if (!note) return res.status(404).json({ msg: "Note not found" });
    
    // Returning the full note object including the references array
    res.json([note]); 
  } catch (err) {
    res.status(500).json({ msg: "Error fetching note" });
  }
});

// --- 5. UPDATE NOTE CONTENT (Save Changes with References) ---
router.post("/updateNote", async (req, res) => {
  try {
    const { noteID, content, references } = req.body; // Added references here
    
    const note = await Document.findOneAndUpdate(
      { _id: noteID, userId: req.user.id },
      { 
        content: content,
        references: references // Save the source cards to the database
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

// --- 6. RENAME DOCUMENT ---
router.post("/rename", async (req, res) => {
  try {
    const { id, name } = req.body;
    const doc = await Document.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { name },
      { new: true }
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ msg: "Error renaming document" });
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


// --- 3.5 ADD BOARD ---
router.post("/addBoard", async (req, res) => {
  try {
    const { name, parentId, content, order } = req.body;

    // Optional: enforce string-only content
    if (content && typeof content !== "string") {
      return res.status(400).json({ msg: "Board content must be a string" });
    }

    const board = await Document.create({
      name,
      parentId: parentId || null,
      content: content || "",
      order: order || Date.now(),
      type: "board",
      userId: req.user.id,
      references: [] // boards don't use references
    });

    res.status(201).json(board);
  } catch (err) {
    console.error("Add Board Error:", err);
    res.status(500).json({ msg: "Error creating board" });
  }
});

// router.post("/addBoard", async(req, res) => {
//    res.json();
// })

// --- UPDATE BOARD ---
router.post("/updateBoard", async (req, res) => {
  try {
    const { boardID, content } = req.body;

    if (!boardID) {
      return res.status(400).json({ msg: "boardID is required" });
    }

    if (typeof content !== "string") {
      return res.status(400).json({ msg: "Board content must be a string" });
    }

    const board = await Document.findOneAndUpdate(
      { 
        _id: boardID,
        userId: req.user.id,
        type: "board"
      },
      { content },
      { new: true }
    );

    if (!board) {
      return res.status(404).json({ msg: "Board not found" });
    }

    res.json(board);

  } catch (err) {
    console.error("Update Board Error:", err);
    res.status(500).json({ msg: "Error updating board" });
  }
});

// --- GET BOARD CONTENT ---
router.post("/getBoardById", async (req, res) => {
  try {
    const { boardID } = req.body;

    if (!boardID) {
      return res.status(400).json({ msg: "boardID is required" });
    }

    // Ensure board belongs to authenticated user
    const board = await Document.findOne({
      _id: boardID,
      userId: req.user.id,
      type: "board"
    });

    if (!board) {
      return res.status(404).json({ msg: "Board not found" });
    }

    // Keep response format consistent with getNoteById
    res.json([board]);

  } catch (err) {
    console.error("Get Board Error:", err);
    res.status(500).json({ msg: "Error fetching board" });
  }
});

export default router;