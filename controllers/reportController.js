import Student from '../models/Student.js';
import PDFDocument from 'pdfkit';
import { generateExcelReport } from '../utils/excelGenerator.js';
import fs from 'fs';
import path from 'path';


// ─── Helper: Build date range ───
const getDateRange = (period, date) => {
  const d = date ? new Date(date) : new Date();
  let start, end;

  switch (period) {
    case 'daily': {
      start = new Date(d);
      start.setHours(0, 0, 0, 0);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'weekly': {
      start = new Date(d);
      start.setDate(start.getDate() - start.getDay()); // Sunday
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly': {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    default: {
      start = new Date(d);
      start.setHours(0, 0, 0, 0);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
    }
  }
  return { start, end };
};

// ─── Helper: Format currency ───
const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-IN')}`;

// ─── Helper: Generate PDF buffer from a builder function ───
const buildPDF = (builder) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    builder(doc);
    doc.end();
  });
};

// ─── Helper: Add PDF header ───
const pdfHeader = (doc, title, subtitle) => {
  const logoPath = path.join(process.cwd(), '../rps-react/public/rps_logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 35, { width: 50 });
  }

  doc.fontSize(22).font('Helvetica-Bold').text('Rudrapur Public School', { align: 'center' });
  doc.fontSize(14).font('Helvetica').text(title, { align: 'center' }).moveDown(0.3);
  if (subtitle) {
    doc.fontSize(10).fillColor('#666666').text(subtitle, { align: 'center' }).fillColor('#000000');
  }
  doc.moveDown(0.5);
  doc.strokeColor('#333333').lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
};

/**
 * @desc    Generate demand bill for a student
 * @route   GET /api/reports/demand-bill/:studentId
 */
export const generateDemandBill = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const format = req.query.format || 'pdf';

    const billData = {
      studentName: student.studentName,
      uid: student.uid,
      className: student.className,
      section: student.section,
      academicYear: student.academicYear || 'N/A',
      tuitionFees: student.feesStructure.tuitionFees,
      transportFees: student.feesStructure.transportFees,
      totalFees: student.feesStructure.totalFees,
      lastYearTuition: student.lastYearDues?.tuition || 0,
      lastYearTransport: student.lastYearDues?.transport || 0,
      lastYearTotal: student.lastYearDues?.total || 0,
      grandTotal: student.feesStructure.totalFees + (student.lastYearDues?.total || 0),
      tuitionPaid: student.feesPaid.tuitionPaid,
      transportPaid: student.feesPaid.transportPaid,
      totalPaid: student.feesPaid.totalPaid,
      tuitionLeft: student.feesLeft.tuitionLeft,
      transportLeft: student.feesLeft.transportLeft,
      totalLeft: student.feesLeft.totalLeft,
      isCustom: student.customFees?.isCustom || false,
      concessionType: student.customFees?.concessionType || 'none',
      concessionValue: student.customFees?.concessionValue || 0,
    };

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title: `Demand Bill — ${student.studentName} (${student.uid})`,
        subtitle: `Academic Year: ${billData.academicYear}`,
        columns: [
          { header: 'Particular', key: 'particular', width: 30 },
          { header: 'Amount (₹)', key: 'amount', width: 20 },
        ],
        rows: [
          { particular: 'Tuition Fees', amount: billData.tuitionFees },
          { particular: 'Transport Fees', amount: billData.transportFees },
          { particular: 'Last Year Tuition Dues', amount: billData.lastYearTuition },
          { particular: 'Last Year Transport Dues', amount: billData.lastYearTransport },
          { particular: '── Grand Total ──', amount: billData.grandTotal },
          { particular: '', amount: '' },
          { particular: 'Tuition Paid', amount: billData.tuitionPaid },
          { particular: 'Transport Paid', amount: billData.transportPaid },
          { particular: '── Total Paid ──', amount: billData.totalPaid },
          { particular: '', amount: '' },
          { particular: 'Tuition Remaining', amount: billData.tuitionLeft },
          { particular: 'Transport Remaining', amount: billData.transportLeft },
          { particular: '── Total Remaining ──', amount: billData.totalLeft },
        ],
        sheetName: 'Demand Bill',
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=DemandBill_${student.uid}.xlsx`);
      return res.send(buffer);
    }

    // PDF
    const pdfBuffer = await buildPDF((doc) => {
      pdfHeader(doc, 'DEMAND BILL', `Academic Year: ${billData.academicYear} | Date: ${new Date().toLocaleDateString('en-IN')}`);

      doc.fontSize(11).font('Helvetica-Bold');
      const info = [
        ['Student Name', billData.studentName],
        ['UID', billData.uid],
        ['Class - Section', `${billData.className} - ${billData.section}`],
      ];
      info.forEach(([l, v]) => {
        doc.font('Helvetica-Bold').text(`${l}: `, { continued: true }).font('Helvetica').text(v);
        doc.moveDown(0.2);
      });

      doc.moveDown(1);
      doc.fontSize(13).font('Helvetica-Bold').text('Fee Details');
      doc.moveDown(0.5);

      const table = [
        ['Particular', 'Amount'],
        ['Tuition Fees (Current Year)', fmt(billData.tuitionFees)],
        ['Transport Fees (Current Year)', fmt(billData.transportFees)],
        ['Last Year Tuition Dues', fmt(billData.lastYearTuition)],
        ['Last Year Transport Dues', fmt(billData.lastYearTransport)],
      ];

      doc.fontSize(11);
      table.forEach(([label, val], i) => {
        if (i === 0) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
        doc.text(`${label}`, 60, doc.y, { width: 300, continued: false });
        doc.moveUp();
        doc.text(`${val}`, 360, doc.y, { width: 150, align: 'right' });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.3);
      doc.rect(50, doc.y, 495, 30).fill('#e0f2fe').fill('#000');
      doc.fontSize(13).font('Helvetica-Bold')
        .text(`Grand Total: ${fmt(billData.grandTotal)}`, 60, doc.y - 22, { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(11).font('Helvetica-Bold').text('Payment Summary');
      doc.moveDown(0.3);
      doc.font('Helvetica');
      doc.text(`Total Paid: ${fmt(billData.totalPaid)}`);
      doc.text(`Total Remaining: ${fmt(billData.totalLeft)}`);
      doc.moveDown(2);

      doc.fontSize(9).fillColor('#666666')
        .text('This is a computer-generated demand bill.', { align: 'center' })
        .text('For queries, contact the school administration.', { align: 'center' });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=DemandBill_${student.uid}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Demand bill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Generate class-wise demand bill
 * @route   GET /api/reports/demand-bill-class
 */
export const generateClassDemandBill = async (req, res) => {
  try {
    const { className, section, format = 'pdf' } = req.query;
    const query = {};
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();

    const students = await Student.find(query).sort({ className: 1, section: 1, studentName: 1 });

    const rows = students.map((s) => ({
      uid: s.uid,
      studentName: s.studentName,
      className: s.className,
      section: s.section,
      tuitionFees: s.feesStructure.tuitionFees,
      transportFees: s.feesStructure.transportFees,
      totalFees: s.feesStructure.totalFees,
      lastYearDues: s.lastYearDues?.total || 0,
      grandTotal: s.feesStructure.totalFees + (s.lastYearDues?.total || 0),
      totalPaid: s.feesPaid.totalPaid,
      totalLeft: s.feesLeft.totalLeft,
    }));

    const columns = [
      { header: 'UID', key: 'uid', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Class', key: 'className', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Tuition (₹)', key: 'tuitionFees', width: 14 },
      { header: 'Transport (₹)', key: 'transportFees', width: 14 },
      { header: 'Last Yr Dues (₹)', key: 'lastYearDues', width: 16 },
      { header: 'Grand Total (₹)', key: 'grandTotal', width: 16 },
      { header: 'Paid (₹)', key: 'totalPaid', width: 14 },
      { header: 'Remaining (₹)', key: 'totalLeft', width: 14 },
    ];

    const filterStr = className ? `Class ${className}${section ? `-${section}` : ''}` : 'All Classes';

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title: `Class Demand Bill — ${filterStr}`,
        subtitle: `Generated on ${new Date().toLocaleDateString('en-IN')}`,
        columns,
        rows,
        sheetName: 'Demand Bills',
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ClassDemandBill_${filterStr}.xlsx`);
      return res.send(buffer);
    }

    // PDF for class demand bill
    const pdfBuffer = await buildPDF((doc) => {
      pdfHeader(doc, `DEMAND BILL — ${filterStr}`, `Generated: ${new Date().toLocaleDateString('en-IN')} | Total Students: ${students.length}`);

      doc.fontSize(9);
      const colWidths = [60, 120, 55, 55, 70, 70, 70];
      const headers = ['UID', 'Name', 'Class', 'Tuition', 'Transport', 'Paid', 'Remaining'];
      let y = doc.y;

      // Header
      doc.font('Helvetica-Bold');
      let x = 50;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 5;

      doc.font('Helvetica').fontSize(8);
      rows.forEach((row) => {
        if (y > 750) { doc.addPage(); y = 50; }
        x = 50;
        [row.uid, row.studentName, `${row.className}-${row.section}`, fmt(row.tuitionFees), fmt(row.transportFees), fmt(row.totalPaid), fmt(row.totalLeft)].forEach((val, i) => {
          doc.text(String(val), x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 13;
      });

      // Totals
      y += 10;
      const totalDue = rows.reduce((s, r) => s + r.totalLeft, 0);
      const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Total Paid: ${fmt(totalPaid)}  |  Total Remaining: ${fmt(totalDue)}`, 50, y, { align: 'center' });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ClassDemandBill_${filterStr}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Class demand bill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Generate last year dues report
 * @route   GET /api/reports/last-year-dues
 */
export const getLastYearDuesReport = async (req, res) => {
  try {
    const { className, section, format = 'json' } = req.query;
    const query = { 'lastYearDues.total': { $gt: 0 } };
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();

    const students = await Student.find(query)
      .select('uid studentName className section lastYearDues feesStructure feesPaid feesLeft')
      .sort({ 'lastYearDues.total': -1 });

    const rows = students.map((s) => ({
      uid: s.uid,
      studentName: s.studentName,
      className: s.className,
      section: s.section,
      lastYearTuition: s.lastYearDues?.tuition || 0,
      lastYearTransport: s.lastYearDues?.transport || 0,
      lastYearTotal: s.lastYearDues?.total || 0,
      fromYear: s.lastYearDues?.fromYear || '',
    }));

    const summary = {
      totalStudents: rows.length,
      totalDues: rows.reduce((s, r) => s + r.lastYearTotal, 0),
    };

    if (format === 'json') {
      return res.json({ students: rows, summary });
    }

    const columns = [
      { header: 'UID', key: 'uid', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Class', key: 'className', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'From Year', key: 'fromYear', width: 12 },
      { header: 'Tuition Dues (₹)', key: 'lastYearTuition', width: 16 },
      { header: 'Transport Dues (₹)', key: 'lastYearTransport', width: 18 },
      { header: 'Total Dues (₹)', key: 'lastYearTotal', width: 16 },
    ];

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title: 'Last Year Dues Report',
        subtitle: `Total: ${fmt(summary.totalDues)} from ${summary.totalStudents} students`,
        columns,
        rows,
        sheetName: 'Last Year Dues',
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=LastYearDues.xlsx');
      return res.send(buffer);
    }

    // PDF
    const pdfBuffer = await buildPDF((doc) => {
      pdfHeader(doc, 'LAST YEAR DUES REPORT', `Total: ${fmt(summary.totalDues)} from ${summary.totalStudents} students`);
      doc.fontSize(9);
      let y = doc.y;
      const colW = [60, 130, 50, 60, 80, 80];
      const hdrs = ['UID', 'Name', 'Class', 'From Year', 'Tuition Dues', 'Transport Dues'];
      doc.font('Helvetica-Bold');
      let x = 50;
      hdrs.forEach((h, i) => { doc.text(h, x, y, { width: colW[i] }); x += colW[i]; });
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 5;
      doc.font('Helvetica').fontSize(8);
      rows.forEach((r) => {
        if (y > 750) { doc.addPage(); y = 50; }
        x = 50;
        [r.uid, r.studentName, `${r.className}-${r.section}`, r.fromYear, fmt(r.lastYearTuition), fmt(r.lastYearTransport)].forEach((v, i) => {
          doc.text(String(v), x, y, { width: colW[i] }); x += colW[i];
        });
        y += 13;
      });
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=LastYearDues.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Last year dues error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Daily / Weekly / Monthly fee collection report
 * @route   GET /api/reports/collection
 */
export const getCollectionReport = async (req, res) => {
  try {
    const { period = 'daily', date, startDate, endDate, className, section, studentSearch, format = 'json' } = req.query;
    
    let start, end;
    if (period === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const range = getDateRange(period, date);
      start = range.start;
      end = range.end;
    }

    const studentMatchQuery = {};
    if (className) studentMatchQuery.className = className;
    if (section) studentMatchQuery.section = section.toUpperCase();
    if (studentSearch) {
      studentMatchQuery.$or = [
        { studentName: { $regex: studentSearch, $options: 'i' } },
        { uid: { $regex: studentSearch, $options: 'i' } }
      ];
    }

    const pipeline = [];
    if (Object.keys(studentMatchQuery).length > 0) {
      pipeline.push({ $match: studentMatchQuery });
    }
    
    pipeline.push(
      { $unwind: '$paymentHistory' },
      {
        $match: {
          'paymentHistory.paidAt': { $gte: start, $lte: end },
          'paymentHistory.status': { $in: ['success', 'cash'] },
        },
      },
      {
        $project: {
          studentName: 1,
          uid: 1,
          className: 1,
          section: 1,
          payment: '$paymentHistory',
        },
      },
      { $sort: { 'payment.paidAt': -1 } }
    );

    // Get payments within the date range
    const payments = await Student.aggregate(pipeline);

    // Summary stats
    const summary = {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalTransactions: payments.length,
      totalAmount: payments.reduce((s, p) => s + p.payment.totalAmount, 0),
      cashAmount: payments.filter((p) => p.payment.status === 'cash').reduce((s, p) => s + p.payment.totalAmount, 0),
      onlineAmount: payments.filter((p) => p.payment.status === 'success').reduce((s, p) => s + p.payment.totalAmount, 0),
      tuitionCollected: payments.reduce((s, p) => s + (p.payment.tuitionAmount || 0), 0),
      transportCollected: payments.reduce((s, p) => s + (p.payment.transportAmount || 0), 0),
    };

    // Day-wise breakdown for weekly/monthly/custom (if custom range > 1 day)
    const dayWise = {};
    if (period === 'weekly' || period === 'monthly' || period === 'custom') {
      payments.forEach((p) => {
        const dayKey = new Date(p.payment.paidAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        if (!dayWise[dayKey]) dayWise[dayKey] = { date: dayKey, count: 0, amount: 0, cash: 0, online: 0 };
        dayWise[dayKey].count++;
        dayWise[dayKey].amount += p.payment.totalAmount;
        if (p.payment.status === 'cash') dayWise[dayKey].cash += p.payment.totalAmount;
        else dayWise[dayKey].online += p.payment.totalAmount;
      });
    }

    const rows = payments.map((p) => ({
      uid: p.uid,
      studentName: p.studentName,
      className: p.className,
      section: p.section,
      paymentType: p.payment.paymentType,
      tuitionAmount: p.payment.tuitionAmount || 0,
      transportAmount: p.payment.transportAmount || 0,
      totalAmount: p.payment.totalAmount,
      mode: p.payment.status === 'cash' ? 'Cash' : 'Online',
      paymentId: p.payment.paymentId,
      date: new Date(p.payment.paidAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      time: new Date(p.payment.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    }));

    if (format === 'json') {
      return res.json({ summary, dayWise: Object.values(dayWise), transactions: rows });
    }

    const columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'UID', key: 'uid', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 20 },
      { header: 'Class', key: 'className', width: 8 },
      { header: 'Type', key: 'paymentType', width: 10 },
      { header: 'Tuition (₹)', key: 'tuitionAmount', width: 12 },
      { header: 'Transport (₹)', key: 'transportAmount', width: 14 },
      { header: 'Total (₹)', key: 'totalAmount', width: 12 },
      { header: 'Mode', key: 'mode', width: 10 },
    ];

    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    
    let filterStr = `Period: ${periodLabel} (${start.toLocaleDateString('en-IN')} - ${end.toLocaleDateString('en-IN')})`;
    if (className) filterStr += ` | Class: ${className}${section ? `-${section}` : ''}`;
    if (studentSearch) filterStr += ` | Student: ${studentSearch}`;

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title: `${periodLabel} Fee Collection Report`,
        subtitle: `${filterStr} | Total: ${fmt(summary.totalAmount)}`,
        columns,
        rows,
        sheetName: 'Collection Report',
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Collection_${periodLabel}.xlsx`);
      return res.send(buffer);
    }

    // PDF
    const pdfBuffer = await buildPDF((doc) => {
      pdfHeader(doc, `${periodLabel.toUpperCase()} FEE COLLECTION REPORT`,
        `${filterStr} | ${payments.length} txns | Total: ${fmt(summary.totalAmount)}`);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Cash: ${fmt(summary.cashAmount)}  |  Online: ${fmt(summary.onlineAmount)}  |  Tuition: ${fmt(summary.tuitionCollected)}  |  Transport: ${fmt(summary.transportCollected)}`);
      doc.moveDown(1);

      doc.fontSize(8);
      let y = doc.y;
      const cw = [50, 50, 65, 110, 55, 55, 55, 55];
      const h = ['Date', 'Time', 'UID', 'Name', 'Tuition', 'Transport', 'Total', 'Mode'];
      doc.font('Helvetica-Bold');
      let xp = 50;
      h.forEach((hdr, i) => { doc.text(hdr, xp, y, { width: cw[i] }); xp += cw[i]; });
      y += 14;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 4;

      doc.font('Helvetica').fontSize(7);
      rows.forEach((r) => {
        if (y > 750) { doc.addPage(); y = 50; }
        xp = 50;
        [r.date, r.time, r.uid, r.studentName, fmt(r.tuitionAmount), fmt(r.transportAmount), fmt(r.totalAmount), r.mode].forEach((v, i) => {
          doc.text(String(v), xp, y, { width: cw[i] }); xp += cw[i];
        });
        y += 12;
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Collection_${periodLabel}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Collection report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Generate customized report by type
 * @route   GET /api/reports/generate
 */
export const generateReport = async (req, res) => {
  try {
    const { type, format = 'json', className, section } = req.query;
    const query = {};
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();

    const students = await Student.find(query).sort({ className: 1, section: 1, studentName: 1 });

    let title = '';
    let columns = [];
    let rows = [];

    switch (type) {
      case 'class-wise-collection': {
        title = 'Class-wise Fee Collection Summary';
        const classMap = {};
        students.forEach((s) => {
          const key = `${s.className}-${s.section}`;
          if (!classMap[key]) classMap[key] = { className: s.className, section: s.section, students: 0, totalFees: 0, totalPaid: 0, totalLeft: 0 };
          classMap[key].students++;
          classMap[key].totalFees += s.feesStructure.totalFees;
          classMap[key].totalPaid += s.feesPaid.totalPaid;
          classMap[key].totalLeft += s.feesLeft.totalLeft;
        });
        columns = [
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Students', key: 'students', width: 10 },
          { header: 'Total Fees (₹)', key: 'totalFees', width: 16 },
          { header: 'Total Paid (₹)', key: 'totalPaid', width: 16 },
          { header: 'Total Pending (₹)', key: 'totalLeft', width: 16 },
          { header: 'Collection %', key: 'percentage', width: 14 },
        ];
        rows = Object.values(classMap).map((r) => ({
          ...r,
          percentage: r.totalFees > 0 ? `${((r.totalPaid / r.totalFees) * 100).toFixed(1)}%` : '0%',
        }));
        break;
      }

      case 'student-wise-dues': {
        title = 'Student-wise Dues Statement';
        columns = [
          { header: 'UID', key: 'uid', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Total Fees (₹)', key: 'totalFees', width: 14 },
          { header: 'Total Paid (₹)', key: 'totalPaid', width: 14 },
          { header: 'Remaining (₹)', key: 'totalLeft', width: 14 },
        ];
        rows = students.map((s) => ({
          uid: s.uid,
          studentName: s.studentName,
          className: s.className,
          section: s.section,
          totalFees: s.feesStructure.totalFees,
          totalPaid: s.feesPaid.totalPaid,
          totalLeft: s.feesLeft.totalLeft,
        }));
        break;
      }

      case 'transport-fee-report': {
        title = 'Transport Fee Report';
        columns = [
          { header: 'UID', key: 'uid', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Transport Fees (₹)', key: 'transportFees', width: 16 },
          { header: 'Transport Paid (₹)', key: 'transportPaid', width: 16 },
          { header: 'Transport Left (₹)', key: 'transportLeft', width: 16 },
        ];
        rows = students
          .filter((s) => s.feesStructure.transportFees > 0)
          .map((s) => ({
            uid: s.uid,
            studentName: s.studentName,
            className: s.className,
            transportFees: s.feesStructure.transportFees,
            transportPaid: s.feesPaid.transportPaid,
            transportLeft: s.feesLeft.transportLeft,
          }));
        break;
      }

      case 'payment-mode-wise': {
        title = 'Payment Mode-wise Report';
        const allPayments = [];
        students.forEach((s) => {
          s.paymentHistory.forEach((p) => {
            if (['success', 'cash'].includes(p.status)) {
              allPayments.push({
                uid: s.uid,
                studentName: s.studentName,
                className: s.className,
                section: s.section,
                mode: p.status === 'cash' ? 'Cash' : 'Online',
                amount: p.totalAmount,
                date: new Date(p.paidAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
                paymentId: p.paymentId,
              });
            }
          });
        });
        columns = [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'UID', key: 'uid', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Mode', key: 'mode', width: 10 },
          { header: 'Amount (₹)', key: 'amount', width: 14 },
          { header: 'Payment ID', key: 'paymentId', width: 20 },
        ];
        rows = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      }

      case 'fee-concession-report': {
        title = 'Fee Concession Report';
        const concessionStudents = students.filter((s) => s.customFees?.isCustom);
        columns = [
          { header: 'UID', key: 'uid', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Concession Type', key: 'concessionType', width: 16 },
          { header: 'Concession Value', key: 'concessionValue', width: 16 },
          { header: 'Reason', key: 'reason', width: 25 },
          { header: 'Custom Tuition (₹)', key: 'tuitionFees', width: 18 },
          { header: 'Custom Transport (₹)', key: 'transportFees', width: 18 },
        ];
        rows = concessionStudents.map((s) => ({
          uid: s.uid,
          studentName: s.studentName,
          className: s.className,
          concessionType: s.customFees.concessionType || 'none',
          concessionValue: s.customFees.concessionValue || 0,
          reason: s.customFees.reason || '',
          tuitionFees: s.customFees.tuitionFees || s.feesStructure.tuitionFees,
          transportFees: s.customFees.transportFees || s.feesStructure.transportFees,
        }));
        break;
      }

      case 'fully-paid-students': {
        title = 'Fully Paid Students Report';
        const fullyPaid = students.filter((s) => s.feesLeft.totalLeft <= 0 && s.feesStructure.totalFees > 0);
        columns = [
          { header: 'UID', key: 'uid', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Class', key: 'className', width: 10 },
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Total Fees (₹)', key: 'totalFees', width: 14 },
          { header: 'Total Paid (₹)', key: 'totalPaid', width: 14 },
        ];
        rows = fullyPaid.map((s) => ({
          uid: s.uid,
          studentName: s.studentName,
          className: s.className,
          section: s.section,
          totalFees: s.feesStructure.totalFees,
          totalPaid: s.feesPaid.totalPaid,
        }));
        break;
      }

      case 'section-wise-summary': {
        title = 'Section-wise Fee Summary';
        const sectionMap = {};
        students.forEach((s) => {
          const key = s.section;
          if (!sectionMap[key]) sectionMap[key] = { section: key, students: 0, totalFees: 0, totalPaid: 0, totalLeft: 0 };
          sectionMap[key].students++;
          sectionMap[key].totalFees += s.feesStructure.totalFees;
          sectionMap[key].totalPaid += s.feesPaid.totalPaid;
          sectionMap[key].totalLeft += s.feesLeft.totalLeft;
        });
        columns = [
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Students', key: 'students', width: 10 },
          { header: 'Total Fees (₹)', key: 'totalFees', width: 16 },
          { header: 'Total Paid (₹)', key: 'totalPaid', width: 16 },
          { header: 'Pending (₹)', key: 'totalLeft', width: 16 },
        ];
        rows = Object.values(sectionMap);
        break;
      }

      default:
        return res.status(400).json({
          message: `Unknown report type: ${type}`,
          availableTypes: [
            'class-wise-collection',
            'student-wise-dues',
            'transport-fee-report',
            'payment-mode-wise',
            'fee-concession-report',
            'fully-paid-students',
            'section-wise-summary',
          ],
        });
    }

    if (format === 'json') {
      return res.json({ title, rows, total: rows.length });
    }

    const filterStr = className ? `Class ${className}${section ? `-${section}` : ''}` : 'All';

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title,
        subtitle: `Filter: ${filterStr} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
        columns,
        rows,
        sheetName: type,
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${type}.xlsx`);
      return res.send(buffer);
    }

    // PDF (generic table)
    const pdfBuffer = await buildPDF((doc) => {
      pdfHeader(doc, title.toUpperCase(), `Filter: ${filterStr} | Total: ${rows.length} records`);
      doc.fontSize(8);
      const maxCols = Math.min(columns.length, 7);
      const colW = Math.floor(495 / maxCols);
      let y = doc.y;

      doc.font('Helvetica-Bold');
      let xp = 50;
      columns.slice(0, maxCols).forEach((col) => {
        doc.text(col.header, xp, y, { width: colW });
        xp += colW;
      });
      y += 14;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 4;

      doc.font('Helvetica').fontSize(7);
      rows.forEach((r) => {
        if (y > 750) { doc.addPage(); y = 50; }
        xp = 50;
        columns.slice(0, maxCols).forEach((col) => {
          const val = r[col.key];
          doc.text(String(val ?? ''), xp, y, { width: colW });
          xp += colW;
        });
        y += 12;
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get available report types
 * @route   GET /api/reports/types
 */
export const getReportTypes = async (req, res) => {
  res.json({
    reports: [
      { id: 'class-wise-collection', name: 'Class-wise Collection Summary', category: 'Collection' },
      { id: 'student-wise-dues', name: 'Student-wise Dues Statement', category: 'Dues' },
      { id: 'transport-fee-report', name: 'Transport Fee Report', category: 'Transport' },
      { id: 'payment-mode-wise', name: 'Payment Mode-wise Report', category: 'Collection' },
      { id: 'fee-concession-report', name: 'Fee Concession Report', category: 'Concession' },
      { id: 'fully-paid-students', name: 'Fully Paid Students', category: 'Collection' },
      { id: 'section-wise-summary', name: 'Section-wise Summary', category: 'Summary' },
    ],
    formats: ['json', 'pdf', 'excel'],
  });
};
