import mongoose from 'mongoose';
import StudentAttendance from '../models/StudentAttendance.js';
import Student from '../models/Student.js';
import { generateAbsentNotificationLink } from '../utils/whatsapp.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Mark attendance for a class-section (bulk)
 * @route   POST /api/student-attendance/mark
 * @access  Admin only
 */
export const markAttendance = async (req, res) => {
  try {
    const { date, className, section, attendance } = req.body;
    // attendance = [{ studentId, status, remarks }]

    if (req.user.role === 'staff') {
      const isAssigned = req.teacher?.assignedClasses?.some(
        (c) => c.className === className && c.section === section.toUpperCase()
      );
      if (!isAssigned) {
        return res.status(403).json({
          message: 'You are only authorized to mark attendance for your assigned classes',
        });
      }
    }

    if (!date || !className || !section || !attendance || !Array.isArray(attendance)) {
      return res.status(400).json({
        message: 'Date, class, section, and attendance array are required',
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const results = [];
    const errors = [];

    // Check if user id is a valid ObjectId (admin env user has string 'admin_env_id')
    const validObjectId = isValidId(req.user.id);

    for (const record of attendance) {
      try {
        const existing = await StudentAttendance.findOne({
          studentId: record.studentId,
          date: attendanceDate,
        });

        if (existing) {
          // If staff is editing, check the 30s lock
          if (req.user.role === 'staff') {
            if (existing.markedByRole === 'staff') {
              const timeDiff = Date.now() - new Date(existing.updatedAt).getTime();
              if (timeDiff > 30000) {
                errors.push({ studentId: record.studentId, error: 'Locked after 30 seconds' });
                continue;
              }
            } else if (existing.markedByRole === 'admin' || existing.markedByRole === 'superadmin') {
              errors.push({ studentId: record.studentId, error: 'Admin has already marked this' });
              continue;
            }
          }

          // Update existing record
          existing.status = record.status;
          existing.remarks = record.remarks || '';
          if (validObjectId) {
            existing.markedBy = req.user.id;
          }
          existing.markedByRole = req.user.role;
          await existing.save();
          results.push(existing);
        } else {
          // Create new record
          const createData = {
            studentId: record.studentId,
            date: attendanceDate,
            className,
            section: section.toUpperCase(),
            status: record.status,
            markedByRole: req.user.role,
            remarks: record.remarks || '',
          };
          if (validObjectId) {
            createData.markedBy = req.user.id;
          }
          const newRecord = await StudentAttendance.create(createData);
          results.push(newRecord);
        }
      } catch (err) {
        errors.push({ studentId: record.studentId, error: err.message });
      }
    }

    res.json({
      message: `Attendance marked for ${results.length} students`,
      marked: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get attendance for a class-section on a date
 * @route   GET /api/student-attendance/by-date
 * @access  Admin only
 */
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date, className, section } = req.query;

    if (req.user.role === 'staff') {
      const isAssigned = req.teacher?.assignedClasses?.some(
        (c) => c.className === className && c.section === section.toUpperCase()
      );
      if (!isAssigned) {
        return res.status(403).json({
          message: 'You can only view attendance for your assigned classes',
        });
      }
    }

    if (!date || !className || !section) {
      return res.status(400).json({
        message: 'Date, class, and section are required',
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Get all students in this class-section
    const students = await Student.find({
      className,
      section: section.toUpperCase(),
    }).select('uid studentName fatherWhatsapp fatherEmail').sort({ studentName: 1 });

    // Get attendance records for this date
    const attendanceRecords = await StudentAttendance.find({
      className,
      section: section.toUpperCase(),
      date: attendanceDate,
    });

    // Map attendance to students
    const attendanceMap = {};
    for (const record of attendanceRecords) {
      attendanceMap[record.studentId.toString()] = record;
    }

    const result = students.map((student) => {
      const record = attendanceMap[student._id.toString()];
      let isLockedForTeacher = false;
      if (req.user.role === 'staff' && record) {
        if (record.markedByRole === 'admin' || record.markedByRole === 'superadmin') {
          isLockedForTeacher = true;
        } else if (record.markedByRole === 'staff') {
          const timeDiff = Date.now() - new Date(record.updatedAt).getTime();
          if (timeDiff > 30000) {
            isLockedForTeacher = true;
          }
        }
      }
      return {
        _id: student._id,
        uid: student.uid,
        studentName: student.studentName,
        fatherWhatsapp: student.fatherWhatsapp,
        fatherEmail: student.fatherEmail,
        attendance: record || null,
        status: record?.status || 'unmarked',
        isLocked: isLockedForTeacher,
      };
    });

    res.json({
      date: attendanceDate,
      className,
      section,
      totalStudents: students.length,
      marked: attendanceRecords.length,
      unmarked: students.length - attendanceRecords.length,
      students: result,
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get individual student's attendance history
 * @route   GET /api/student-attendance/history/:studentId
 * @access  Admin only
 */
export const getStudentAttendanceHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year, startDate, endDate } = req.query;

    const query = { studentId };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (month && year) {
      const startD = new Date(year, month - 1, 1);
      const endD = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startD, $lte: endD };
    }

    const records = await StudentAttendance.find(query).sort({ date: -1 });

    // Calculate stats
    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      halfDay: records.filter((r) => r.status === 'half-day').length,
    };
    stats.percentage = stats.total > 0
      ? Math.round((stats.present / stats.total) * 100)
      : 0;

    res.json({ records, stats });
  } catch (error) {
    console.error('Get student attendance history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update a single attendance record
 * @route   PUT /api/student-attendance/update/:id
 * @access  Admin only
 */
export const updateAttendance = async (req, res) => {
  try {
    const record = await StudentAttendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const { status, remarks } = req.body;
    if (status) record.status = status;
    if (remarks !== undefined) record.remarks = remarks;
    if (isValidId(req.user.id)) {
      record.markedBy = req.user.id;
    }

    await record.save();
    res.json(record);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get attendance stats (class-wise / section-wise summary)
 * @route   GET /api/student-attendance/stats
 * @access  Admin only
 */
export const getAttendanceStats = async (req, res) => {
  try {
    const { date, month, year } = req.query;

    let matchQuery = {};

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      matchQuery.date = { $gte: d, $lt: nextDay };
    } else if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      matchQuery.date = { $gte: startDate, $lte: endDate };
    }

    const stats = await StudentAttendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { className: '$className', section: '$section', status: '$status' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { className: '$_id.className', section: '$_id.section' },
          statuses: {
            $push: { status: '$_id.status', count: '$count' },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { '_id.className': 1, '_id.section': 1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Generate WhatsApp notification links for absent students
 * @route   POST /api/student-attendance/notify-absent
 * @access  Admin only
 */
export const notifyAbsentStudents = async (req, res) => {
  try {
    const { date, className, section, customMessage } = req.body;

    if (!date || !className || !section) {
      return res.status(400).json({
        message: 'Date, class, and section are required',
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Find absent students
    const absentRecords = await StudentAttendance.find({
      date: attendanceDate,
      className,
      section: section.toUpperCase(),
      status: 'absent',
    }).populate({
      path: 'studentId',
      select: 'studentName fatherWhatsapp className section',
    });

    const notifications = [];

    for (const record of absentRecords) {
      if (record.studentId?.fatherWhatsapp) {
        const notification = generateAbsentNotificationLink(
          record.studentId.fatherWhatsapp,
          record.studentId.studentName,
          `${record.className}-${record.section}`,
          date,
          customMessage || ''
        );
        notifications.push({
          studentName: record.studentId.studentName,
          phone: record.studentId.fatherWhatsapp,
          ...notification,
        });
      }
    }

    res.json({
      totalAbsent: absentRecords.length,
      notificationsGenerated: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Notify absent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get attendance record for a class and section within a date range
 * @route   GET /api/student-attendance/class-record
 * @access  Admin only
 */
export const getClassAttendanceRecord = async (req, res) => {
  try {
    const { className, section, startDate, endDate } = req.query;

    if (req.user.role === 'staff') {
      const isAssigned = req.teacher?.assignedClasses?.some(
        (c) => c.className === className && c.section === section.toUpperCase()
      );
      if (!isAssigned) {
        return res.status(403).json({
          message: 'You can only view attendance for your assigned classes',
        });
      }
    }

    if (!className || !section || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Class, section, startDate, and endDate are required',
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get all students in this class-section
    const students = await Student.find({
      className,
      section: section.toUpperCase(),
    }).select('uid studentName fatherWhatsapp fatherEmail').sort({ studentName: 1 });

    // Get attendance records for this date range
    const attendanceRecords = await StudentAttendance.find({
      className,
      section: section.toUpperCase(),
      date: { $gte: start, $lte: end },
    });

    // Group records by studentId and then by date (YYYY-MM-DD)
    const recordsMap = {};
    for (const record of attendanceRecords) {
      const sId = record.studentId.toString();
      if (!recordsMap[sId]) recordsMap[sId] = {};
      
      const d = new Date(record.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      recordsMap[sId][dateStr] = record;
    }

    const result = students.map((student) => ({
      _id: student._id,
      uid: student.uid,
      studentName: student.studentName,
      attendance: recordsMap[student._id.toString()] || {},
    }));

    res.json({
      className,
      section,
      startDate: start,
      endDate: end,
      students: result,
      totalRecordsFetched: attendanceRecords.length,
    });
  } catch (error) {
    console.error('Get class attendance record error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
