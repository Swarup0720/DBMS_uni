const express = require('express');
const examinationController = require('../controllers/examinationController');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Examinations endpoints
router.get('/examinations', requireRole('admin', 'faculty'), examinationController.listExams);
router.post('/examinations', requireRole('admin', 'faculty'), examinationController.createExam);
router.put('/examinations/:id', requireRole('admin', 'faculty'), examinationController.updateExam);
router.delete('/examinations/:id', requireRole('admin', 'faculty'), examinationController.deleteExam);
router.get('/examinations/:id/marks', requireRole('admin', 'faculty'), examinationController.getExamMarks);
router.post('/examinations/:id/marks', requireRole('admin', 'faculty'), examinationController.saveExamMarks);

// Results endpoints
router.get('/results/my', requireRole('student'), examinationController.getMyResults);
router.get('/results', requireRole('admin', 'faculty'), examinationController.getResultsReport);
router.put('/results/:id', requireRole('admin', 'faculty'), examinationController.updateResult);

module.exports = router;

