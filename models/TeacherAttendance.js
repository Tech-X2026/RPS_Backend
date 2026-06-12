import mongoose from 'mongoose';

const teacherAttendanceSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    inTime: {
      type: Date,
      default: null,
    },
    outTime: {
      type: Date,
      default: null,
    },
    inLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    outLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'leave'],
      default: 'absent',
    },
    lateIn: {
      type: Boolean,
      default: false,
    },
    earlyOut: {
      type: Boolean,
      default: false,
    },
    effectiveDay: {
      type: Number, // 1 = full day, 0.5 = half day, 0 = absent
      default: 0,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'markedByModel',
    },
    markedByModel: {
      type: String,
      enum: ['Admin', 'Teacher'],
      default: 'Admin',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound unique index: one attendance record per teacher per date
teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ date: 1 });

/**
 * Pre-save hook: auto-calculate attendance status based on timing rules
 * In Time: 8:30 AM
 * Out Time: 3:00 PM
 * Late after 8:35 AM → half-day
 * Early out before 3:00 PM → half-day
 */
teacherAttendanceSchema.pre('save', function (next) {
  // If status is manually set to 'leave' or 'absent', respect it
  if (this.status === 'leave') {
    this.effectiveDay = 0;
    return next();
  }

  if (!this.inTime && !this.outTime) {
    this.status = 'absent';
    this.effectiveDay = 0;
    this.lateIn = false;
    this.earlyOut = false;
    return next();
  }

  // Check late in (after 8:35 AM)
  if (this.inTime) {
    const inDate = new Date(this.inTime);
    const hours = inDate.getHours();
    const minutes = inDate.getMinutes();
    // 8:35 AM = 8 hours 35 minutes
    this.lateIn = hours > 8 || (hours === 8 && minutes > 35);
  }

  // Check early out (before 3:00 PM)
  if (this.outTime) {
    const outDate = new Date(this.outTime);
    const hours = outDate.getHours();
    const minutes = outDate.getMinutes();
    // 3:00 PM = 15 hours 0 minutes
    this.earlyOut = hours < 15;
  }

  // Determine status and effective day
  if (this.lateIn || this.earlyOut) {
    this.status = 'half-day';
    this.effectiveDay = 0.5;
  } else if (this.inTime) {
    this.status = 'present';
    this.effectiveDay = 1;
  }

  next();
});

const TeacherAttendance = mongoose.model('TeacherAttendance', teacherAttendanceSchema);
export default TeacherAttendance;
