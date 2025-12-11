import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import Folder from "../models/Folder.js";
import Note from "../models/Note.js";
import { requireAuth } from '../middleware/auth.js';

dotenv.config();
const router = express.Router();

router.use(requireAuth);

router.post("/addFolder", async (req, res) => {
  try {
    const { name } = req.body;
    const userID = jwt.decode(req.cookies?.[process.env.COOKIE_NAME]).id;
    const folder = await Folder.create({ userId: userID, name });
    res.status(201).json(folder);
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/getFolders", async (req, res) => {
  const userID = jwt.decode(req.cookies?.[process.env.COOKIE_NAME]).id;
  const folders = await Folder.find({ userId: userID });
  res.status(201).json(folders);
});

router.post("/getNotes", async (req, res) => {
  const { folderID } = req.body;
  const notes = await Note.find({ folderId: folderID });
  res.status(201).json(notes);
});

router.post("/getNoteById", async (req, res) => {
  const { noteID } = req.body;
  const userID = jwt.decode(req.cookies?.[process.env.COOKIE_NAME]).id;
  const note = await Note.find({ _id: noteID, userId: userID });
  res.status(201).json(note);
});

router.post("/updateNote", async (req, res) => {
  try {
    const { noteID, content } = req.body;
    const userID = jwt.decode(req.cookies?.[process.env.COOKIE_NAME]).id;

    const note = await Note.findOneAndUpdate(
      { _id: noteID, userId: userID },
      { content, updatedAt: new Date() },
      { new: true }
    );

    if (!note) return res.status(404).json({ msg: "Note not found" });
    res.json(note);
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/addNote", async (req, res) => {
  try {
    const { name, folderID } = req.body;
    const userID = jwt.decode(req.cookies?.[process.env.COOKIE_NAME]).id;
    const note = await Note.create({ userId: userID, folderId: folderID, name, content: "" });
    res.status(201).json(note);
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
