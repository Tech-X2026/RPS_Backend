import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema(
  {
    stopName: {
      type: String,
      required: [true, 'Stop name is required'],
      trim: true,
    },
    fee: {
      type: Number,
      required: [true, 'Stop fee is required'],
      min: [0, 'Fee cannot be negative'],
    },
    pickupTime: {
      type: String,
      trim: true,
      default: '',
    },
    dropTime: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const transportRouteSchema = new mongoose.Schema(
  {
    routeName: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true,
    },
    routeNumber: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
    },
    stops: [stopSchema],
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    driverName: {
      type: String,
      trim: true,
      default: '',
    },
    driverPhone: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const TransportRoute = mongoose.model('TransportRoute', transportRouteSchema);
export default TransportRoute;
