const express = require('express');
const facultyController = require('../controllers/facultyController');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireRole('admin'));

router.get('/', facultyController.list);
router.get('/:id', facultyController.getById);
router.post('/', facultyController.create);
router.put('/:id', facultyController.update);
router.patch('/:id/department', facultyController.assignDepartment);
router.delete('/:id', facultyController.remove);

module.exports = router;

