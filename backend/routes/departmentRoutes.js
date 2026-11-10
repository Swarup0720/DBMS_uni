const express = require('express');
const departmentController = require('../controllers/departmentController');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireRole('admin', 'faculty'), departmentController.list);
router.get('/:id', requireRole('admin', 'faculty'), departmentController.getById);
router.post('/', requireRole('admin'), departmentController.create);
router.put('/:id', requireRole('admin'), departmentController.update);
router.delete('/:id', requireRole('admin'), departmentController.remove);

module.exports = router;

