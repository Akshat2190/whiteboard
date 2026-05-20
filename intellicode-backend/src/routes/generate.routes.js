const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const generateController = require('../controllers/generate.controller');

router.use(protect);
router.post('/:id', generateController.generateCode);

module.exports = router;
