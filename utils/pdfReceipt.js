import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate a PDF payment receipt
 * @param {Object} data - Receipt data
 * @param {string} data.studentName
 * @param {string} data.uid
 * @param {string} data.className
 * @param {string} data.section
 * @param {string} data.paymentType
 * @param {number} data.tuitionAmount
 * @param {number} data.transportAmount
 * @param {number} data.totalAmount
 * @param {string} data.paymentId
 * @param {string} data.orderId
 * @param {Date} data.paidAt
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateReceipt = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      const logoPath = path.join(process.cwd(), '../rps-react/public/rps_logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 35, { width: 50 });
      }

      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Rudrapur Public School', { align: 'center' })
        .fontSize(12)
        .font('Helvetica')
        .text('Fee Payment Receipt', { align: 'center' })
        .moveDown(0.5);

      // Divider
      doc
        .strokeColor('#333333')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Receipt details
      const receiptDate = data.paidAt
        ? new Date(data.paidAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Receipt Date: ', { continued: true })
        .font('Helvetica')
        .text(receiptDate)
        .moveDown(0.3);

      doc
        .font('Helvetica-Bold')
        .text('Payment ID: ', { continued: true })
        .font('Helvetica')
        .text(data.paymentId || 'N/A')
        .moveDown(0.3);

      doc
        .font('Helvetica-Bold')
        .text('Order ID: ', { continued: true })
        .font('Helvetica')
        .text(data.orderId || 'N/A')
        .moveDown(1);

      // Student Info Section
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Student Information')
        .moveDown(0.5);

      const infoItems = [
        ['Student Name', data.studentName],
        ['UID', data.uid],
        ['Class', data.className],
        ['Section', data.section],
      ];

      for (const [label, value] of infoItems) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`${label}: `, { continued: true })
          .font('Helvetica')
          .text(value || 'N/A')
          .moveDown(0.2);
      }

      doc.moveDown(1);

      // Payment Details Section
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Payment Details')
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Payment Type: ', { continued: true })
        .font('Helvetica')
        .text(data.paymentType ? data.paymentType.charAt(0).toUpperCase() + data.paymentType.slice(1) : 'N/A')
        .moveDown(0.3);

      if (data.tuitionAmount > 0) {
        doc
          .font('Helvetica-Bold')
          .text('Tuition Fees Paid: ', { continued: true })
          .font('Helvetica')
          .text(`Rs. ${data.tuitionAmount.toLocaleString('en-IN')}`)
          .moveDown(0.2);
      }

      if (data.transportAmount > 0) {
        doc
          .font('Helvetica-Bold')
          .text('Transport Fees Paid: ', { continued: true })
          .font('Helvetica')
          .text(`Rs. ${data.transportAmount.toLocaleString('en-IN')}`)
          .moveDown(0.2);
      }

      doc.moveDown(0.5);

      // Total amount box
      const currentY = doc.y;

      doc
        .rect(50, currentY, 495, 40)
        .fill('#f0f0f0');

      doc.fill('#000000');

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(
          `Total Amount Paid: Rs. ${data.totalAmount.toLocaleString('en-IN')}`,
          50,
          currentY + 13,
          { width: 475, align: 'right' }
        );

      doc.y = currentY + 60;

      // Footer
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#666666')
        .text('This is a computer-generated receipt. No signature required.', {
          align: 'center',
        })
        .text('For any queries, please contact the school administration.', {
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default generateReceipt;
