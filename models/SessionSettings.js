import mongoose from 'mongoose';

const sessionSettingsSchema = new mongoose.Schema(
  {
    sessionYear: {
      type: String,
      required: [true, 'Session year is required'],
      trim: true,
      // e.g. "2026-2027"
    },
    startMonth: {
      type: Number,
      required: true,
      min: 0,
      max: 11,
      default: 3, // April (0-indexed)
    },
    endMonth: {
      type: Number,
      required: true,
      min: 0,
      max: 11,
      default: 2, // March (0-indexed)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/**
 * Calculate total billing months from startMonth to endMonth (inclusive, wrapping around year boundary)
 */
sessionSettingsSchema.methods.getTotalMonths = function () {
  if (this.endMonth >= this.startMonth) {
    return this.endMonth - this.startMonth + 1;
  }
  // Wraps around year (e.g. April=3 to March=2 => 12 months)
  return 12 - this.startMonth + this.endMonth + 1;
};

/**
 * Get the ordered list of month numbers in this session
 */
sessionSettingsSchema.methods.getSessionMonths = function () {
  const months = [];
  let m = this.startMonth;
  const total = this.getTotalMonths();
  for (let i = 0; i < total; i++) {
    months.push(m % 12);
    m++;
  }
  return months;
};

const SessionSettings = mongoose.model('SessionSettings', sessionSettingsSchema);
export default SessionSettings;
