import mongoose from 'mongoose';

const paymentHistorySchema = new mongoose.Schema(
  {
    paymentType: {
      type: String,
      enum: ['tuition', 'transport', 'combined', 'registration', 'admission', 'development', 'schoolKit'],
      required: true,
    },
    tuitionAmount: { type: Number, default: 0 },
    transportAmount: { type: Number, default: 0 },
    registrationAmount: { type: Number, default: 0 },
    admissionAmount: { type: Number, default: 0 },
    developmentAmount: { type: Number, default: 0 },
    schoolKitAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentId: { type: String, required: true },
    orderId: { type: String, required: true },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'cash'],
      default: 'pending',
    },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const studentSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    fatherEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    fatherWhatsapp: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    className: {
      type: String,
      required: [true, 'Class is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      trim: true,
    },

    // Academic year
    academicYear: {
      type: String,
      default: () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        // Academic year starts in April (month 3)
        if (month >= 3) return `${year}-${(year + 1).toString().slice(-2)}`;
        return `${year - 1}-${year.toString().slice(-2)}`;
      },
      trim: true,
    },

    // Last year's dues carried forward
    lastYearDues: {
      tuition: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      fromYear: { type: String, default: '' },
    },

    // Custom fee override for this specific student
    customFees: {
      isCustom: { type: Boolean, default: false },
      tuitionFees: { type: Number },
      transportFees: { type: Number },
      registrationFee: { type: Number },
      admissionFee: { type: Number },
      developmentFee: { type: Number },
      schoolKitFee: { type: Number },
      concessionType: {
        type: String,
        enum: ['none', 'percentage', 'fixed'],
        default: 'none',
      },
      concessionValue: { type: Number, default: 0 },
      reason: { type: String, default: '' },
    },

    // Sibling group reference
    siblingGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SiblingGroup',
      default: null,
    },

    // Transport route assignment
    transportRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      default: null,
    },
    transportStop: {
      type: String,
      trim: true,
      default: '',
    },

    // Fee structure assigned to this student
    feesStructure: {
      tuitionFees: { type: Number, default: 0 },
      transportFees: { type: Number, default: 0 },
      registrationFee: { type: Number, default: 0 },
      admissionFee: { type: Number, default: 0 },
      developmentFee: { type: Number, default: 0 },
      schoolKitFee: { type: Number, default: 0 },
      totalFees: { type: Number, default: 0 },
    },

    // Fees paid so far
    feesPaid: {
      tuitionPaid: { type: Number, default: 0 },
      transportPaid: { type: Number, default: 0 },
      registrationPaid: { type: Number, default: 0 },
      admissionPaid: { type: Number, default: 0 },
      developmentPaid: { type: Number, default: 0 },
      schoolKitPaid: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },

    // Fees remaining
    feesLeft: {
      tuitionLeft: { type: Number, default: 0 },
      transportLeft: { type: Number, default: 0 },
      registrationLeft: { type: Number, default: 0 },
      admissionLeft: { type: Number, default: 0 },
      developmentLeft: { type: Number, default: 0 },
      schoolKitLeft: { type: Number, default: 0 },
      totalLeft: { type: Number, default: 0 },
    },

    // Payment history
    paymentHistory: [paymentHistorySchema],
  },
  { timestamps: true }
);

// Compound index for quick lookups
studentSchema.index({ className: 1, section: 1 });
studentSchema.index({ studentName: 'text', uid: 'text' });

// Pre-save: recalculate totals
studentSchema.pre('save', function (next) {
  // If custom fees are set, use those instead of class-level structure
  if (this.customFees && this.customFees.isCustom) {
    if (this.customFees.tuitionFees !== undefined) {
      this.feesStructure.tuitionFees = this.customFees.tuitionFees;
    }
    if (this.customFees.transportFees !== undefined) {
      this.feesStructure.transportFees = this.customFees.transportFees;
    }
    if (this.customFees.registrationFee !== undefined) {
      this.feesStructure.registrationFee = this.customFees.registrationFee;
    }
    if (this.customFees.admissionFee !== undefined) {
      this.feesStructure.admissionFee = this.customFees.admissionFee;
    }
    if (this.customFees.developmentFee !== undefined) {
      this.feesStructure.developmentFee = this.customFees.developmentFee;
    }
    if (this.customFees.schoolKitFee !== undefined) {
      this.feesStructure.schoolKitFee = this.customFees.schoolKitFee;
    }
  }

  // Calculate last year dues total
  if (this.lastYearDues) {
    this.lastYearDues.total =
      (this.lastYearDues.tuition || 0) + (this.lastYearDues.transport || 0);
  }

  // Calculate total fees (including last year dues)
  this.feesStructure.totalFees =
    (this.feesStructure.tuitionFees || 0) + 
    (this.feesStructure.transportFees || 0) +
    (this.feesStructure.registrationFee || 0) +
    (this.feesStructure.admissionFee || 0) +
    (this.feesStructure.developmentFee || 0) +
    (this.feesStructure.schoolKitFee || 0);

  // Calculate total paid
  this.feesPaid.totalPaid =
    (this.feesPaid.tuitionPaid || 0) + 
    (this.feesPaid.transportPaid || 0) +
    (this.feesPaid.registrationPaid || 0) +
    (this.feesPaid.admissionPaid || 0) +
    (this.feesPaid.developmentPaid || 0) +
    (this.feesPaid.schoolKitPaid || 0);

  // Calculate total left
  this.feesLeft.tuitionLeft = (this.feesStructure.tuitionFees || 0) - (this.feesPaid.tuitionPaid || 0);
  this.feesLeft.transportLeft = (this.feesStructure.transportFees || 0) - (this.feesPaid.transportPaid || 0);
  this.feesLeft.registrationLeft = (this.feesStructure.registrationFee || 0) - (this.feesPaid.registrationPaid || 0);
  this.feesLeft.admissionLeft = (this.feesStructure.admissionFee || 0) - (this.feesPaid.admissionPaid || 0);
  this.feesLeft.developmentLeft = (this.feesStructure.developmentFee || 0) - (this.feesPaid.developmentPaid || 0);
  this.feesLeft.schoolKitLeft = (this.feesStructure.schoolKitFee || 0) - (this.feesPaid.schoolKitPaid || 0);
  
  this.feesLeft.totalLeft =
    this.feesLeft.tuitionLeft + 
    this.feesLeft.transportLeft +
    this.feesLeft.registrationLeft +
    this.feesLeft.admissionLeft +
    this.feesLeft.developmentLeft +
    this.feesLeft.schoolKitLeft;

  next();
});

const Student = mongoose.model('Student', studentSchema);
export default Student;
