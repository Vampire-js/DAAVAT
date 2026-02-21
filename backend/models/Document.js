import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // 'folder' or 'note'
  parentId: { type: String, required: false, default: null },
  content: { type: String, required: false },
  order: { type: Number, required: true, default: 0 },
  
  // ADD THIS SECTION:
  references: [{
    id: { type: String },
    source: { type: String, enum: ["YouTube", "PDF", "Audio"] },
    title: { type: String },
    content: { type: String }
  }]
}, {
  timestamps: true
});

export const Document = mongoose.model('Document', documentSchema);