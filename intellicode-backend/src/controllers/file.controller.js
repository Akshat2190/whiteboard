const File = require('../models/File.model');

const getFiles = async (req, res, next) => {
  try {
    const files = await File.find({ project: req.params.id }).populate('lastEditedBy', 'name');
    res.status(200).json({ success: true, files });
  } catch (error) {
    next(error);
  }
};

const getFile = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.status(200).json({ success: true, file });
  } catch (error) {
    next(error);
  }
};

const updateFile = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    file.code = req.body.code ?? file.code;
    file.lastEditedBy = req.user._id;
    file.lastEditedAt = new Date();
    await file.save();

    res.status(200).json({ success: true, file });
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    await File.findByIdAndDelete(req.params.fileId);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFiles,
  getFile,
  updateFile,
  deleteFile,
};
