import express from 'express';
import {
  markAttendance,
  getAttendanceByDate,
  getStudentAttendanceHistory,
  updateAttendance,
  getAttendanceStats,
  notifyAbsentStudents,
  getClassAttendanceRecord,
} from '../controllers/studentAttendanceController.js';
import protect from '../middleware/auth.js';
import { staffOrAdmin } from '../middleware/roleGuard.js';

const router = express.Router();

// All student attendance routes are accessible to staff and admin
router.use(protect, staffOrAdmin);

router.post('/mark', markAttendance);
router.get('/by-date', getAttendanceByDate);
router.get('/stats', getAttendanceStats);
router.get('/history/:studentId', getStudentAttendanceHistory);
router.put('/update/:id', updateAttendance);
router.post('/notify-absent', notifyAbsentStudents);
router.get('/class-record', getClassAttendanceRecord);

export default router;
