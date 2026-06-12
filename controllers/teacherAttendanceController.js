import mongoose from 'mongoose';
import TeacherAttendance from '../models/TeacherAttendance.js';
import Teacher from '../models/Teacher.js';
import { generateTeacherNotificationLink } from '../utils/whatsapp.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Teacher clock in (staff or admin)
 * @route   POST /api/teacher-attendance/clock-in
 * @access  Staff or Admin
 */
export const clockIn = async (req, res) => {
  try {
    let teacherId = req.body.teacherId;

    // Staff can only clock in for themselves
    if (req.user.role === 'staff') {
      teacherId = req.user.id;
    }

    if (!teacherId) {
      return res.status(400).json({ message: 'Teacher ID is required' });
    }

    if (req.user.role === 'staff') {
      const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      if (istTime.getDay() === 0) {
        return res.status(403).json({ message: 'Sunday attendance is auto-calculated. Cannot clock in.' });
      }
      if (istTime.getHours() < 8) {
        return res.status(403).json({ message: 'Action is locked before 8:00 AM.' });
      }
      if (istTime.getHours() >= 15) {
        return res.status(403).json({ message: 'Clock in is locked after 3:00 PM. Please contact Admin.' });
      }
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Check if already clocked in today
    let attendance = await TeacherAttendance.findOne({
      teacherId,
      date: { $gte: startDate, $lte: endDate },
    });

    if (attendance && attendance.inTime) {
      return res.status(400).json({ message: 'Already clocked in today' });
    }

    const { lat, lng } = req.body;
    let location = null;
    if (lat && lng) {
      location = { lat, lng };
    }

    if (req.user.role === 'staff' && !location) {
      return res.status(400).json({ message: 'Location access is required to clock in. Please enable GPS.' });
    }

    if (attendance) {
      attendance.inTime = today;
      if (location) attendance.inLocation = location;
      if (isValidId(req.user.id)) attendance.markedBy = req.user.id;
      attendance.markedByModel = req.user.model;
    } else {
      attendance = new TeacherAttendance({
        teacherId,
        date: startDate,
        inTime: today,
        inLocation: location || { lat: null, lng: null },
        ...(isValidId(req.user.id) && { markedBy: req.user.id }),
        markedByModel: req.user.model,
      });
    }

    await attendance.save(); // Pre-save hook will calculate status
    await attendance.populate('teacherId', 'name email phone');

    res.json({
      message: 'Clocked in successfully',
      attendance,
    });
  } catch (error) {
    console.error('Clock in error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Attendance already recorded for today' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Teacher clock out (staff or admin)
 * @route   POST /api/teacher-attendance/clock-out
 * @access  Staff or Admin
 */
export const clockOut = async (req, res) => {
  try {
    let teacherId = req.body.teacherId;

    // Staff can only clock out for themselves
    if (req.user.role === 'staff') {
      teacherId = req.user.id;
    }

    if (!teacherId) {
      return res.status(400).json({ message: 'Teacher ID is required' });
    }

    if (req.user.role === 'staff') {
      const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      if (istTime.getDay() === 0) {
        return res.status(403).json({ message: 'Sunday attendance is auto-calculated. Cannot clock out.' });
      }
      if (istTime.getHours() < 8) {
        return res.status(403).json({ message: 'Action is locked before 8:00 AM.' });
      }
      if (istTime.getHours() > 15 || (istTime.getHours() === 15 && istTime.getMinutes() >= 30)) {
        return res.status(403).json({ message: 'Clock out is locked after 3:30 PM. Auto clock-out applied.' });
      }
    }

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const attendance = await TeacherAttendance.findOne({
      teacherId,
      date: { $gte: startDate, $lte: endDate },
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No clock-in record found for today. Please clock in first.' });
    }

    if (attendance.outTime) {
      return res.status(400).json({ message: 'Already clocked out today' });
    }

    const { lat, lng } = req.body;
    if (req.user.role === 'staff' && (!lat || !lng)) {
      return res.status(400).json({ message: 'Location access is required to clock out. Please enable GPS.' });
    }

    if (lat && lng) {
      attendance.outLocation = { lat, lng };
    }

    attendance.outTime = today;
    if (isValidId(req.user.id)) attendance.markedBy = req.user.id;
    attendance.markedByModel = req.user.model;

    await attendance.save(); // Pre-save hook will recalculate
    await attendance.populate('teacherId', 'name email phone');

    res.json({
      message: 'Clocked out successfully',
      attendance,
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Admin manually marks teacher attendance
 * @route   POST /api/teacher-attendance/mark
 * @access  Admin only
 */
export const markTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, date, inTime, outTime, status, remarks } = req.body;

    if (!teacherId || !date) {
      return res.status(400).json({ message: 'Teacher ID and date are required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    let attendance = await TeacherAttendance.findOne({
      teacherId,
      date: { $gte: startDate, $lte: endDate },
    });

    if (attendance) {
      // Update existing
      if (inTime) attendance.inTime = new Date(inTime);
      if (outTime) attendance.outTime = new Date(outTime);
      if (status === 'leave' || status === 'absent') {
        attendance.status = status;
        attendance.effectiveDay = 0;
        attendance.inTime = null;
        attendance.outTime = null;
      }
      if (remarks !== undefined) attendance.remarks = remarks;
      if (isValidId(req.user.id)) attendance.markedBy = req.user.id;
      attendance.markedByModel = 'Admin';
    } else {
      // Create new
      attendance = new TeacherAttendance({
        teacherId,
        date: startDate,
        inTime: status === 'leave' || status === 'absent' ? null : (inTime ? new Date(inTime) : null),
        outTime: status === 'leave' || status === 'absent' ? null : (outTime ? new Date(outTime) : null),
        status: status || 'absent',
        remarks: remarks || '',
        ...(isValidId(req.user.id) && { markedBy: req.user.id }),
        markedByModel: 'Admin',
      });

      if (status === 'leave' || status === 'absent') {
        attendance.effectiveDay = 0;
      }
    }

    await attendance.save();
    await attendance.populate('teacherId', 'name email phone');

    res.json({ message: 'Attendance updated', attendance });
  } catch (error) {
    console.error('Mark teacher attendance error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Attendance already exists for this date' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all teachers' attendance for a date
 * @route   GET /api/teacher-attendance/by-date
 * @access  Staff or Admin (staff sees read-only)
 */
export const getTeacherAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get all active teachers
    const teachers = await Teacher.find({ status: 'active' })
      .select('-password')
      .sort({ name: 1 });

    // Get attendance records
    const records = await TeacherAttendance.find({ date: { $gte: startDate, $lte: endDate } });

    const attendanceMap = {};
    for (const record of records) {
      attendanceMap[record.teacherId.toString()] = record;
    }

    const result = teachers.map((teacher) => ({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      subject: teacher.subject,
      attendance: attendanceMap[teacher._id.toString()] || null,
      status: attendanceMap[teacher._id.toString()]?.status || 'unmarked',
      inTime: attendanceMap[teacher._id.toString()]?.inTime || null,
      outTime: attendanceMap[teacher._id.toString()]?.outTime || null,
      inLocation: attendanceMap[teacher._id.toString()]?.inLocation || null,
      outLocation: attendanceMap[teacher._id.toString()]?.outLocation || null,
      lateIn: attendanceMap[teacher._id.toString()]?.lateIn || false,
      earlyOut: attendanceMap[teacher._id.toString()]?.earlyOut || false,
      effectiveDay: attendanceMap[teacher._id.toString()]?.effectiveDay ?? null,
    }));

    res.json({
      date: startDate,
      totalTeachers: teachers.length,
      marked: records.length,
      unmarked: teachers.length - records.length,
      teachers: result,
    });
  } catch (error) {
    console.error('Get teacher attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get teacher's own attendance history (for staff dashboard)
 * @route   GET /api/teacher-attendance/my-attendance
 * @access  Staff
 */
export const getMyAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { month, year } = req.query;

    const query = { teacherId };

    // Get teacher's salary info
    const teacher = await Teacher.findById(teacherId).select('monthlySalary name joiningDate');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    let sundays = 0;
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };

      let joiningDate = teacher.joiningDate ? new Date(teacher.joiningDate) : new Date('2000-01-01');
      joiningDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const calcEnd = endDate > today ? today : endDate;
      const calcStart = startDate < joiningDate ? joiningDate : startDate;

      if (calcStart <= calcEnd) {
        const tempDate = new Date(calcStart);
        while (tempDate <= calcEnd) {
          if (tempDate.getDay() === 0) sundays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }
      }
    }

    const records = await TeacherAttendance.find(query).sort({ date: -1 });

    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      halfDay: records.filter((r) => r.status === 'half-day').length,
      absent: records.filter((r) => r.status === 'absent').length,
      leave: records.filter((r) => r.status === 'leave').length,
      effectiveDays: records.reduce((sum, r) => sum + r.effectiveDay, 0) + sundays,
    };

    res.json({ records, stats, teacher });
  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get individual teacher's attendance history
 * @route   GET /api/teacher-attendance/history/:teacherId
 * @access  Admin only
 */
export const getTeacherAttendanceHistory = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month, year } = req.query;

    const query = { teacherId };

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    let sundays = 0;
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };

      let joiningDate = teacher.joiningDate ? new Date(teacher.joiningDate) : new Date('2000-01-01');
      joiningDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const calcEnd = endDate > today ? today : endDate;
      const calcStart = startDate < joiningDate ? joiningDate : startDate;

      if (calcStart <= calcEnd) {
        const tempDate = new Date(calcStart);
        while (tempDate <= calcEnd) {
          if (tempDate.getDay() === 0) sundays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }
      }
    }

    const records = await TeacherAttendance.find(query).sort({ date: -1 });

    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      halfDay: records.filter((r) => r.status === 'half-day').length,
      absent: records.filter((r) => r.status === 'absent').length,
      leave: records.filter((r) => r.status === 'leave').length,
      effectiveDays: records.reduce((sum, r) => sum + r.effectiveDay, 0) + sundays,
    };

    res.json({ records, stats, teacher });
  } catch (error) {
    console.error('Get teacher attendance history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update teacher attendance record
 * @route   PUT /api/teacher-attendance/update/:id
 * @access  Admin only
 */
export const updateTeacherAttendance = async (req, res) => {
  try {
    const record = await TeacherAttendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const { inTime, outTime, status, remarks } = req.body;

    if (status === 'leave' || status === 'absent') {
      record.status = status;
      record.effectiveDay = 0;
      record.inTime = null;
      record.outTime = null;
      record.lateIn = false;
      record.earlyOut = false;
    } else {
      if (status !== undefined) record.status = status;
      if (inTime !== undefined) record.inTime = inTime ? new Date(inTime) : null;
      if (outTime !== undefined) record.outTime = outTime ? new Date(outTime) : null;
    }

    if (remarks !== undefined) record.remarks = remarks;
    if (isValidId(req.user.id)) record.markedBy = req.user.id;
    record.markedByModel = 'Admin';

    await record.save(); // Pre-save recalculates
    await record.populate('teacherId', 'name email phone');

    res.json(record);
  } catch (error) {
    console.error('Update teacher attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Monthly salary report for all teachers
 * @route   GET /api/teacher-attendance/salary-report
 * @access  Admin only
 */
export const getMonthlySalaryReport = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Calculate working days (total days in month)
    let workingDays = 0;
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      workingDays++;
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const teachers = await Teacher.find({ status: 'active' }).select('-password').sort({ name: 1 });

    const report = [];

    for (const teacher of teachers) {
      const records = await TeacherAttendance.find({
        teacherId: teacher._id,
        date: { $gte: startDate, $lte: endDate },
      });

      const presentDays = records.filter((r) => r.status === 'present').length;
      const halfDays = records.filter((r) => r.status === 'half-day').length;
      const absentDays = records.filter((r) => r.status === 'absent').length;
      const leaveDays = records.filter((r) => r.status === 'leave').length;

      // Calculate effective days from records and add eligible Sundays
      let teacherSundays = 0;
      let joiningDate = teacher.joiningDate ? new Date(teacher.joiningDate) : new Date('2000-01-01');
      joiningDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const calcEnd = endDate > today ? today : endDate;
      const calcStart = startDate < joiningDate ? joiningDate : startDate;

      if (calcStart <= calcEnd) {
        const tempSundayDate = new Date(calcStart);
        while (tempSundayDate <= calcEnd) {
          if (tempSundayDate.getDay() === 0) teacherSundays++;
          tempSundayDate.setDate(tempSundayDate.getDate() + 1);
        }
      }

      let effectiveDays = records.reduce((sum, r) => sum + r.effectiveDay, 0);
      effectiveDays += teacherSundays;

      const perDaySalary = teacher.monthlySalary / workingDays;
      const grossSalary = teacher.monthlySalary;
      const earnedSalary = Math.round(perDaySalary * effectiveDays);
      const deduction = grossSalary - earnedSalary;

      report.push({
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          subject: teacher.subject,
          monthlySalary: teacher.monthlySalary,
        },
        workingDays,
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        effectiveDays,
        grossSalary,
        earnedSalary,
        deduction,
        netSalary: earnedSalary,
      });
    }

    res.json({
      month: parseInt(month),
      year: parseInt(year),
      workingDays,
      monthName: startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      report,
    });
  } catch (error) {
    console.error('Salary report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Generate WhatsApp notification for a teacher
 * @route   POST /api/teacher-attendance/notify
 * @access  Admin only
 */
export const notifyTeacher = async (req, res) => {
  try {
    const { teacherId, notificationType, details, customMessage } = req.body;

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (!teacher.phone) {
      return res.status(400).json({ message: 'Teacher does not have a phone number' });
    }

    const notification = generateTeacherNotificationLink(
      teacher.phone,
      teacher.name,
      notificationType,
      details || {},
      customMessage || ''
    );

    res.json({
      teacherName: teacher.name,
      phone: teacher.phone,
      ...notification,
    });
  } catch (error) {
    console.error('Notify teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
