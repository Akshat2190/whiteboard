const File = require('../models/File.model');
const claudeService = require('../services/claude.service');

const extensionLanguageMap = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.css': 'css',
  '.html': 'html',
  '.json': 'json',
};

const getLanguage = (filename) => {
  const extension = filename.slice(filename.lastIndexOf('.'));
  return extensionLanguageMap[extension] || 'other';
};

const generateCode = async (req, res, next) => {
  try {
    const objects = req.body.objects;
    if (!Array.isArray(objects) || objects.length === 0) {
      return res.status(400).json({ success: false, error: 'No whiteboard objects provided' });
    }

    const result = await claudeService.generateCodeFromDiagram(objects);
    const savedFiles = [];

    for (const file of result.files) {
      const language = getLanguage(file.filename);
      const createdFile = await File.create({
        project: req.params.id,
        filename: file.filename,
        code: file.code,
        language,
        generatedAt: new Date(),
        lastEditedBy: req.user._id,
      });
      savedFiles.push(createdFile);
    }

    res.status(201).json({ success: true, files: savedFiles });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateCode };
