import cron from 'node-cron';
import TeacherAttendance from '../models/TeacherAttendance.js';

export const initCronJobs = () => {
  // Run daily at 15:30 IST to auto clock out staff who forgot to clock out
  cron.schedule('30 15 * * *', async () => {
    try {
      console.log('Running auto clock-out job at 15:30 IST');
      
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      // Find all records for today where inTime exists but outTime is null
      const activeAttendances = await TeacherAttendance.find({
        date: { $gte: startDate, $lte: endDate },
        inTime: { $ne: null },
        outTime: null,
      });

      console.log(`Found ${activeAttendances.length} staff to auto clock-out.`);

      // Set outTime to current time
      for (const record of activeAttendances) {
        record.outTime = new Date();
        record.remarks = record.remarks ? record.remarks + ' (Auto clocked out)' : 'Auto clocked out';
        await record.save(); // Pre-save hook calculates effective day automatically
      }

      console.log('Auto clock-out job completed successfully.');
    } catch (error) {
      console.error('Error in auto clock-out cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
};
