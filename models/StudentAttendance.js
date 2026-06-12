import mongoose from 'mongoose';

const studentAttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day'],
      required: true,
      default: 'present',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    markedByRole: {
      type: String,
      enum: ['admin', 'superadmin', 'staff'],
      default: 'admin',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound unique index: one attendance record per student per date
studentAttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Index for querying by class-section and date
studentAttendanceSchema.index({ className: 1, section: 1, date: 1 });
studentAttendanceSchema.index({ date: 1 });

const StudentAttendance = mongoose.model('StudentAttendance', studentAttendanceSchema);
export default StudentAttendance;
