const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  type: {
    type: String,
    enum: ['text', 'ai', 'system'],
    default: 'text',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

messageSchema.index({ project: 1, timestamp: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
