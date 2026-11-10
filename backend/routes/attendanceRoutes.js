const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireRole('admin', 'faculty'));

router.get('/session', attendanceController.getSessionRoster);
router.post('/mark', attendanceController.markAttendance);
router.get('/report', attendanceController.getReport);
router.get('/', attendanceController.listRecords);
router.put('/:id', attendanceController.updateRecord);

module.exports = router;

