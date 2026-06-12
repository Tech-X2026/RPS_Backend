import express from 'express';
import {
  clockIn,
  clockOut,
  markTeacherAttendance,
  getTeacherAttendanceByDate,
  getMyAttendance,
  getTeacherAttendanceHistory,
  updateTeacherAttendance,
  getMonthlySalaryReport,
  notifyTeacher,
} from '../controllers/teacherAttendanceController.js';
import protect from '../middleware/auth.js';
import { adminOnly, staffOrAdmin } from '../middleware/roleGuard.js';

const router = express.Router();

// All routes require auth
router.use(protect);

// Staff + Admin: clock in/out and view attendance
router.post('/clock-in', staffOrAdmin, clockIn);
router.post('/clock-out', staffOrAdmin, clockOut);
router.get('/by-date', staffOrAdmin, getTeacherAttendanceByDate);
router.get('/my-attendance', staffOrAdmin, getMyAttendance);

// Admin only: mark, update, reports, notify
router.post('/mark', adminOnly, markTeacherAttendance);
router.get('/history/:teacherId', adminOnly, getTeacherAttendanceHistory);
router.put('/update/:id', adminOnly, updateTeacherAttendance);
router.get('/salary-report', adminOnly, getMonthlySalaryReport);
router.post('/notify', adminOnly, notifyTeacher);

export default router;
