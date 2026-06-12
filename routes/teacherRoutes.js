import express from 'express';
import {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacherController.js';
import protect from '../middleware/auth.js';
import { adminOnly } from '../middleware/roleGuard.js';

const router = express.Router();

// All teacher management routes are admin only
router.use(protect, adminOnly);

router.post('/create', createTeacher);
router.get('/all', getAllTeachers);
router.get('/:id', getTeacherById);
router.put('/update/:id', updateTeacher);
router.delete('/delete/:id', deleteTeacher);

export default router;
