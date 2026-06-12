/**
 * WhatsApp Deep Link Generator
 * Generates wa.me links with pre-filled messages
 * No API needed - opens WhatsApp directly on click
 */

/**
 * Clean phone number for wa.me (remove +, spaces, dashes)
 * Ensures country code (defaults to India +91)
 */
const cleanPhone = (phone) => {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  // If doesn't start with country code, prepend 91 (India)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
};

/**
 * Generate WhatsApp link for fee reminder (with optional monthly info)
 */
export const generateFeeReminderLink = (phone, studentName, className, pendingAmount, customMessage = '', monthlyInfo = null) => {
  const cleanedPhone = cleanPhone(phone);

  let monthlySection = '';
  if (monthlyInfo && monthlyInfo.overdueMonths > 0) {
    monthlySection = `
📅 *Monthly Fee: ₹${monthlyInfo.monthlyTotal.toLocaleString('en-IN')}*
  - Tuition: ₹${monthlyInfo.monthlyTuition.toLocaleString('en-IN')}/month
  - Transport: ₹${monthlyInfo.monthlyTransport.toLocaleString('en-IN')}/month
⚠️ *Overdue: ${monthlyInfo.overdueMonths} month(s) (₹${monthlyInfo.overdueAmount.toLocaleString('en-IN')})*
`;
  }

  const defaultMessage = `Dear Parent,

This is a reminder from *Rudrapur Public School* regarding pending fees for your child *${studentName}* (Class: ${className}).

💰 *Total Pending Amount: ₹${pendingAmount.toLocaleString('en-IN')}*
${monthlySection}
Kindly clear the pending dues at the earliest.

Thank you,
Rudrapur Public School Administration`;

  const message = customMessage || defaultMessage;
  return {
    link: `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`,
    message,
    phone: cleanedPhone,
  };
};

/**
 * Generate WhatsApp link for absent student notification
 */
export const generateAbsentNotificationLink = (phone, studentName, className, date, customMessage = '') => {
  const cleanedPhone = cleanPhone(phone);
  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const defaultMessage = `Dear Parent,

This is to inform you that your child *${studentName}* (Class: ${className}) was *absent* on *${formattedDate}*.

If this was unplanned, kindly contact the school.

Thank you,
Rudrapur Public School Administration`;

  const message = customMessage || defaultMessage;
  return {
    link: `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`,
    message,
    phone: cleanedPhone,
  };
};

/**
 * Generate WhatsApp link for teacher notification
 */
export const generateTeacherNotificationLink = (phone, teacherName, notificationType, details = {}, customMessage = '') => {
  const cleanedPhone = cleanPhone(phone);
  let defaultMessage = '';

  switch (notificationType) {
    case 'late':
      defaultMessage = `Dear *${teacherName}*,

This is to inform you that your attendance for *${details.date}* has been marked as *Half Day* due to late arrival.

⏰ In Time: 8:30 AM
⏰ Your Arrival: ${details.inTime}

Please ensure punctuality.

Rudrapur Public School Administration`;
      break;

    case 'early-out':
      defaultMessage = `Dear *${teacherName}*,

This is to inform you that your attendance for *${details.date}* has been marked as *Half Day* due to early departure.

⏰ Out Time: 3:00 PM
⏰ Your Departure: ${details.outTime}

Rudrapur Public School Administration`;
      break;

    case 'absent':
      defaultMessage = `Dear *${teacherName}*,

Your attendance for *${details.date}* has been marked as *Absent*.

If this is incorrect, please contact the administration.

Rudrapur Public School Administration`;
      break;

    case 'salary':
      defaultMessage = `Dear *${teacherName}*,

Here is your salary summary for *${details.month}*:

📅 Working Days: ${details.totalDays}
✅ Present: ${details.presentDays}
½ Half Days: ${details.halfDays}
❌ Absent: ${details.absentDays}
📊 Effective Days: ${details.effectiveDays}

💰 Gross Salary: ₹${details.grossSalary?.toLocaleString('en-IN')}
➖ Deduction: ₹${details.deduction?.toLocaleString('en-IN')}
✅ *Net Salary: ₹${details.netSalary?.toLocaleString('en-IN')}*

Rudrapur Public School Administration`;
      break;

    default:
      defaultMessage = `Dear *${teacherName}*,

${details.message || 'This is a notification from Rudrapur Public School.'}

Rudrapur Public School Administration`;
  }

  const message = customMessage || defaultMessage;
  return {
    link: `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`,
    message,
    phone: cleanedPhone,
  };
};
