import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // 'folder' or 'note'
  parentId: { type: String, required: false, default: null }, // Allows nesting
  content: { type: String, required: false }, // Only for notes
  order: { type: Number, required: true, default: 0 } 
}, {
  timestamps: true
});

export const Document = mongoose.model('Document', documentSchema);