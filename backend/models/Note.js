import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  folderId: { type: String, required: true },
  name: { type: String, required: true },
  content: { type: String, required: false },
  // ADD THIS: Array to store individual source card data
  references: [{
    id: String,
    source: { type: String, enum: ["YouTube", "PDF", "Audio"] },
    title: String,
    content: String
  }]
}, {
  timestamps: true
});

const Note = mongoose.model('Note', noteSchema);
export default Note;