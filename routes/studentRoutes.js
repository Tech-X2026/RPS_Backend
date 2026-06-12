import express from 'express';
import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  exportStudents,
  getDashboardStats,
} from '../controllers/studentController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/create', createStudent);
router.get('/all', getAllStudents);
router.get('/stats', getDashboardStats);
router.get('/export', exportStudents);
router.get('/:id', getStudentById);
router.put('/update/:id', updateStudent);
router.delete('/delete/:id', deleteStudent);

export default router;
