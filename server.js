import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';



// Route imports
import adminRoutes from './routes/adminRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import feesRoutes from './routes/feesRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import studentAttendanceRoutes from './routes/studentAttendanceRoutes.js';
import teacherAttendanceRoutes from './routes/teacherAttendanceRoutes.js';
import feeReminderRoutes from './routes/feeReminderRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import defaulterRoutes from './routes/defaulterRoutes.js';
import siblingRoutes from './routes/siblingRoutes.js';
import transportRoutes from './routes/transportRoutes.js';
import importRoutes from './routes/importRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { initCronJobs } from './utils/cronJobs.js';

// Config
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Resolve static frontend path
let distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  const fallbackPath = path.join(__dirname, '../rps-react/dist');
  if (fs.existsSync(path.join(fallbackPath, 'index.html'))) {
    distPath = fallbackPath;
  }
}

// Connect to MongoDB
connectDB();

// Initialize Cron Jobs
initCronJobs();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased limit to handle simultaneous logins and high API traffic
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, curl)
    if (!origin) return callback(null, true);
    // Allow any localhost port
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    // Allow configured frontend URL
    const allowed = process.env.FRONTEND_URL || 'http://localhost:5174';
    if (origin === allowed) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(distPath));
app.use(express.static(path.join(__dirname, '../rps-react/public')));

app.use('/api/', limiter);

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student-attendance', studentAttendanceRoutes);
app.use('/api/teacher-attendance', teacherAttendanceRoutes);
app.use('/api/fee-reminder', feeReminderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/defaulters', defaulterRoutes);
app.use('/api/siblings', siblingRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/session', sessionRoutes);

// Serve public payment page
app.get('/pay/:linkId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'payment.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Wildcard route to serve React app (for client-side routing)
app.get('*any', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    next();
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Payment page: http://localhost:${PORT}/pay/:linkId`);
  console.log(`📊 API health: http://localhost:${PORT}/api/health`);
});

export default app;
