import nodemailer from 'nodemailer';

/**
 * Send an email with optional PDF attachment
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML body
 * @param {Buffer} [options.pdfBuffer] - Optional PDF buffer to attach
 * @param {string} [options.pdfFilename] - Optional PDF filename
 */
const sendEmail = async ({ to, subject, html, pdfBuffer, pdfFilename }) => {
  // Skip if SMTP not configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️ SMTP not configured, skipping email send');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Rudrapur Public School" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    // Attach PDF if provided
    if (pdfBuffer && pdfFilename) {
      mailOptions.attachments = [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    }

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return false;
  }
};

/**
 * Send payment receipt email
 */
export const sendReceiptEmail = async (studentEmail, studentName, receiptData, pdfBuffer) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">Rudrapur Public School</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Payment Receipt</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p>Dear Parent/Guardian,</p>
        <p>We have successfully received the fee payment for <strong>${studentName}</strong>.</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Payment Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Payment Type</td><td style="text-align: right; font-weight: bold;">${receiptData.paymentType}</td></tr>
            ${receiptData.tuitionAmount > 0 ? `<tr><td style="padding: 8px 0; color: #666;">Tuition Fees</td><td style="text-align: right;">₹${receiptData.tuitionAmount.toLocaleString('en-IN')}</td></tr>` : ''}
            ${receiptData.transportAmount > 0 ? `<tr><td style="padding: 8px 0; color: #666;">Transport Fees</td><td style="text-align: right;">₹${receiptData.transportAmount.toLocaleString('en-IN')}</td></tr>` : ''}
            <tr style="border-top: 2px solid #eee;"><td style="padding: 12px 0; font-weight: bold;">Total Paid</td><td style="text-align: right; font-weight: bold; font-size: 18px; color: #10B981;">₹${receiptData.totalAmount.toLocaleString('en-IN')}</td></tr>
          </table>
        </div>
        <p>Please find the detailed receipt attached to this email.</p>
        <p style="color: #999; font-size: 12px;">Payment ID: ${receiptData.paymentId}<br>Date: ${new Date(receiptData.paidAt).toLocaleDateString('en-IN')}</p>
      </div>
      <div style="background: #333; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; margin: 0; font-size: 12px;">This is an automated email from Rudrapur Public School ERP System.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: studentEmail,
    subject: `Payment Receipt - ${studentName} - Rudrapur Public School`,
    html,
    pdfBuffer,
    pdfFilename: `Receipt_${receiptData.paymentId}.pdf`,
  });
};

export default sendEmail;
