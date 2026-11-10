const express = require('express');
const dbmsController = require('../controllers/dbmsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', dbmsController.listConcepts);
router.get('/:id', dbmsController.runConcept);

module.exports = router;

