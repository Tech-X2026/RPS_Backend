import mongoose from 'mongoose';

const siblingGroupSchema = new mongoose.Schema(
  {
    familyId: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
    },
    parentName: {
      type: String,
      required: [true, 'Parent name is required'],
      trim: true,
    },
    parentPhone: {
      type: String,
      trim: true,
    },
    parentEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    transportDiscount: {
      secondChild: { type: Number, default: 50 }, // percentage off
      thirdChildOnwards: { type: Number, default: 100 }, // percentage off
    },
  },
  { timestamps: true }
);

// Auto-generate familyId
siblingGroupSchema.pre('save', async function (next) {
  if (!this.familyId) {
    const SiblingGroup = mongoose.model('SiblingGroup');
    const latest = await SiblingGroup.findOne({})
      .sort({ familyId: -1 })
      .select('familyId');

    let serial = 1;
    if (latest && latest.familyId) {
      const num = parseInt(latest.familyId.replace('FAM-', ''), 10);
      if (!isNaN(num)) serial = num + 1;
    }
    this.familyId = `FAM-${serial.toString().padStart(3, '0')}`;
  }
  next();
});

const SiblingGroup = mongoose.model('SiblingGroup', siblingGroupSchema);
export default SiblingGroup;
