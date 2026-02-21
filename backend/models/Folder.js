import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true }
}, {
  timestamps: true
});

const Folder = mongoose.model('Folder', folderSchema);
export default Folder;
