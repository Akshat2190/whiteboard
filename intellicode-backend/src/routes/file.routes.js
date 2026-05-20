const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/project/:id', fileController.getFiles);
router.get('/:fileId', fileController.getFile);
router.put('/:fileId', fileController.updateFile);
router.delete('/:fileId', fileController.deleteFile);

module.exports = router;
