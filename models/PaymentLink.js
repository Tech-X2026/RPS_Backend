import mongoose from 'mongoose';

const paymentLinkSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
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
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [1, 'Amount must be at least ₹1'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'failed'],
      default: 'pending',
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  { timestamps: true }
);

// TTL index: auto-delete expired links after 7 days past expiry
paymentLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

// Virtual for payment link URL
paymentLinkSchema.virtual('paymentLink').get(function () {
  return `${process.env.BACKEND_URL || 'http://localhost:5000'}/pay/${this._id}`;
});

// Ensure virtuals are included in JSON output
paymentLinkSchema.set('toJSON', { virtuals: true });
paymentLinkSchema.set('toObject', { virtuals: true });

const PaymentLink = mongoose.model('PaymentLink', paymentLinkSchema);
export default PaymentLink;
