const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    default: '',
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 'json', 'python', 'other'],
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastEditedAt: {
    type: Date,
  },
});

fileSchema.index({ project: 1 });

const File = mongoose.model('File', fileSchema);

module.exports = File;
