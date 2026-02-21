import express from "express";
import dotenv from "dotenv";
import { requireAuth } from "../middleware/auth.js";
import { Document } from "../models/Document.js";

dotenv.config();
const router = express.Router();

// Protect all routes
router.use(requireAuth);

//
// ===============================
// 1️⃣ GET ALL DOCUMENTS
// ===============================
router.get("/documents", async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user.id }).sort({ order: 1 });
    res.json(docs);
  } catch (err) {
    console.error("GET Documents Error:", err);
    res.status(500).json({ msg: "Error fetching documents" });
  }
});

//
// ===============================
// 2️⃣ ADD FOLDER
// ===============================
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
    console.error("Add Folder Error:", err);
    res.status(500).json({ msg: "Error creating folder" });
  }
});

//
// ===============================
// 3️⃣ ADD NOTE
// ===============================
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
      references: references || [],
    });

    res.status(201).json(note);
  } catch (err) {
    console.error("Add Note Error:", err);
    res.status(500).json({ msg: "Error creating note" });
  }
});

//
// ===============================
// 4️⃣ GET NOTE
// ===============================
router.post("/getNoteById", async (req, res) => {
  try {
    const { noteID } = req.body;

    const note = await Document.findOne({
      _id: noteID,
      userId: req.user.id,
      type: "note",
    });

    if (!note) {
      return res.status(404).json({ msg: "Note not found" });
    }

    res.json([note]);
  } catch (err) {
    console.error("Get Note Error:", err);
    res.status(500).json({ msg: "Error fetching note" });
  }
});

//
// ===============================
// 5️⃣ UPDATE NOTE
// ===============================
router.post("/updateNote", async (req, res) => {
  try {
    const { noteID, content, references } = req.body;

    const note = await Document.findOneAndUpdate(
      { _id: noteID, userId: req.user.id, type: "note" },
      { content, references },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ msg: "Note not found" });
    }

    res.json(note);
  } catch (err) {
    console.error("Update Note Error:", err);
    res.status(500).json({ msg: "Error updating note" });
  }
});

//
// ===============================
// 6️⃣ ADD BOARD
// ===============================
router.post("/addBoard", async (req, res) => {
  try {
    const { name, parentId, content, order } = req.body;

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
      references: [],
    });

    res.status(201).json(board);
  } catch (err) {
    console.error("Add Board Error:", err);
    res.status(500).json({ msg: "Error creating board" });
  }
});

//
// ===============================
// 7️⃣ GET BOARD
// ===============================
router.post("/getBoardById", async (req, res) => {
  try {
    const { boardID } = req.body;

    const board = await Document.findOne({
      _id: boardID,
      userId: req.user.id,
      type: "board",
    });

    if (!board) {
      return res.status(404).json({ msg: "Board not found" });
    }

    res.json([board]);
  } catch (err) {
    console.error("Get Board Error:", err);
    res.status(500).json({ msg: "Error fetching board" });
  }
});

//
// ===============================
// 8️⃣ UPDATE BOARD
// ===============================
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
      { _id: boardID, userId: req.user.id, type: "board" },
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

//
// ===============================
// 9️⃣ RENAME ITEM (Unified)
// ===============================
router.post("/renameItem", async (req, res) => {
  try {
    const { id, newName } = req.body;

    const doc = await Document.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { name: newName },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({
        error: "Item not found or unauthorized",
      });
    }

    res.status(200).json(doc);
  } catch (error) {
    console.error("Rename Error:", error);
    res.status(500).json({ error: "Failed to rename item" });
  }
});

//
// ===============================
// 🔟 DELETE DOCUMENT
// ===============================
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    await Document.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    res.json({ msg: "Deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ msg: "Error deleting document" });
  }
});

export default router;