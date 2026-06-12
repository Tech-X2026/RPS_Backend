import mongoose from 'mongoose';

const feesStructureSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      trim: true,
    },
    className: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      trim: true,
    },
    tuitionFees: {
      type: Number,
      required: [true, 'Tuition fees is required'],
      min: [0, 'Tuition fees cannot be negative'],
    },
    transportFees: {
      type: Number,
      default: 0,
      min: [0, 'Transport fees cannot be negative'],
    },
    registrationFee: {
      type: Number,
      default: 0,
      min: [0, 'Registration fee cannot be negative'],
    },
    admissionFee: {
      type: Number,
      default: 0,
      min: [0, 'Admission fee cannot be negative'],
    },
    developmentFee: {
      type: Number,
      default: 0,
      min: [0, 'Development fee cannot be negative'],
    },
    schoolKitFee: {
      type: Number,
      default: 0,
      min: [0, 'School Kit fee cannot be negative'],
    },
  },
  { timestamps: true }
);

// Compound unique index: one structure per class-section
feesStructureSchema.index({ className: 1, section: 1 }, { unique: true });

// Generate UID before saving
feesStructureSchema.pre('save', function (next) {
  if (!this.uid) {
    this.uid = `FEE-${this.className}${this.section}`.toUpperCase();
  }
  next();
});

const FeesStructure = mongoose.model('FeesStructure', feesStructureSchema);
export default FeesStructure;
