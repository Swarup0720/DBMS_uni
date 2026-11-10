const express = require('express');
const studentController = require('../controllers/studentController');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireRole('admin', 'faculty'), studentController.list);
router.get('/:id', requireRole('admin', 'faculty'), studentController.getById);
router.post('/', requireRole('admin'), studentController.create);
router.put('/:id', requireRole('admin'), studentController.update);
router.delete('/:id', requireRole('admin'), studentController.remove);

module.exports = router;

