import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  folderId: { type: String, required: true },
  name: { type: String, required: true },
  content: { type: String, required: false }
}, {
  timestamps: true
});

const Note = mongoose.model('Note', noteSchema);
export default Note;
