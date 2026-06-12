import Student from '../models/Student.js';
import SessionSettings from '../models/SessionSettings.js';
import { generateExcelReport } from '../utils/excelGenerator.js';
import PDFDocument from 'pdfkit';

const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-IN')}`;

const buildPDF = (builder) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    builder(doc);
    doc.end();
  });
};

/**
 * Helper: Calculate elapsed months from session start to current date
 */
const getElapsedMonths = (session) => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  const totalMonths = session.getTotalMonths();

  // Parse session year to get start year (e.g. "2026-2027" => 2026)
  const startYear = parseInt(session.sessionYear.split('-')[0]);

  // Calculate the actual start date of session
  const sessionStartMonth = session.startMonth;
  let sessionStartYear = startYear;

  // Calculate months elapsed
  let elapsed = (currentYear - sessionStartYear) * 12 + (currentMonth - sessionStartMonth) + 1;

  // Clamp between 0 and total session months
  if (elapsed < 0) elapsed = 0;
  if (elapsed > totalMonths) elapsed = totalMonths;

  return elapsed;
};

/**
 * Helper: Compute monthly defaulter info for a student
 */
const computeMonthlyInfo = (student, session) => {
  const totalMonths = session.getTotalMonths();
  const elapsedMonths = getElapsedMonths(session);

  const yearlyTuition = student.feesStructure?.tuitionFees || 0;
  const yearlyTransport = student.feesStructure?.transportFees || 0;

  const monthlyTuition = totalMonths > 0 ? Math.round(yearlyTuition / totalMonths) : 0;
  const monthlyTransport = totalMonths > 0 ? Math.round(yearlyTransport / totalMonths) : 0;
  const monthlyTotal = monthlyTuition + monthlyTransport;

  // Expected payment by now (tuition + transport only, not one-time fees)
  const expectedTuition = Math.min(yearlyTuition, monthlyTuition * elapsedMonths);
  const expectedTransport = Math.min(yearlyTransport, monthlyTransport * elapsedMonths);
  const expectedPayment = expectedTuition + expectedTransport;

  // Actual tuition + transport paid
  const tuitionPaid = student.feesPaid?.tuitionPaid || 0;
  const transportPaid = student.feesPaid?.transportPaid || 0;
  const regularPaid = tuitionPaid + transportPaid;

  // Overdue amount separated so overpaid tuition doesn't hide overdue transport
  const overdueTuition = Math.max(0, expectedTuition - tuitionPaid);
  const overdueTransport = Math.max(0, expectedTransport - transportPaid);
  const overdueAmount = overdueTuition + overdueTransport;

  // How many months worth of fees are overdue
  const overdueMonths = monthlyTotal > 0 ? Math.ceil(overdueAmount / monthlyTotal) : 0;
  const overdueTuitionMonths = monthlyTuition > 0 ? Math.ceil(overdueTuition / monthlyTuition) : 0;
  const overdueTransportMonths = monthlyTransport > 0 ? Math.ceil(overdueTransport / monthlyTransport) : 0;

  // How many months are covered by payments
  const monthsCovered = monthlyTotal > 0 ? Math.floor(regularPaid / monthlyTotal) : 0;

  // Severity based on overdue months
  let severity = 'low';
  if (overdueMonths >= 3) severity = 'high';
  else if (overdueMonths >= 2) severity = 'medium';

  return {
    monthlyTuition,
    monthlyTransport,
    monthlyTotal,
    expectedPayment,
    regularPaid,
    overdueAmount,
    overdueMonths,
    overdueTuitionMonths,
    overdueTransportMonths,
    monthsCovered,
    elapsedMonths,
    totalMonths,
    severity,
  };
};

/**
 * @desc    Get fee defaulters list (monthly-based)
 * @route   GET /api/defaulters
 */
export const getDefaulters = async (req, res) => {
  try {
    const { className, section, minAmount, severity, page = 1, limit = 50 } = req.query;

    // Get active session
    let session = await SessionSettings.findOne({ isActive: true });
    if (!session) {
      // Create default session if none exists
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startYear = month >= 3 ? year : year - 1;
      session = await SessionSettings.create({
        sessionYear: `${startYear}-${startYear + 1}`,
        startMonth: 3,
        endMonth: 2,
        isActive: true,
      });
    }

    const query = {};
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();

    const students = await Student.find(query)
      .select('uid studentName fatherWhatsapp fatherEmail className section feesStructure feesPaid feesLeft paymentHistory createdAt')
      .sort({ 'feesLeft.totalLeft': -1 });

    // Calculate monthly defaulter info for each student
    let defaulterList = students
      .map((s) => {
        const doc = s.toObject();
        const monthly = computeMonthlyInfo(s, session);

        // Only include if they have overdue months
        if (monthly.overdueMonths <= 0) return null;

        return {
          _id: doc._id,
          uid: doc.uid,
          studentName: doc.studentName,
          fatherWhatsapp: doc.fatherWhatsapp || '',
          fatherEmail: doc.fatherEmail || '',
          className: doc.className,
          section: doc.section,
          totalFees: doc.feesStructure.totalFees,
          totalPaid: doc.feesPaid.totalPaid,
          totalLeft: doc.feesLeft.totalLeft,
          tuitionLeft: doc.feesLeft.tuitionLeft,
          transportLeft: doc.feesLeft.transportLeft,
          monthlyTuition: monthly.monthlyTuition,
          monthlyTransport: monthly.monthlyTransport,
          monthlyTotal: monthly.monthlyTotal,
          overdueMonths: monthly.overdueMonths,
          overdueTuitionMonths: monthly.overdueTuitionMonths,
          overdueTransportMonths: monthly.overdueTransportMonths,
          overdueAmount: monthly.overdueAmount,
          monthsCovered: monthly.monthsCovered,
          elapsedMonths: monthly.elapsedMonths,
          totalMonths: monthly.totalMonths,
          severity: monthly.severity,
        };
      })
      .filter(Boolean);

    // Filter by minimum overdue amount
    if (minAmount) {
      defaulterList = defaulterList.filter((d) => d.overdueAmount >= Number(minAmount));
    }

    // Filter by severity
    if (severity) {
      defaulterList = defaulterList.filter((s) => s.severity === severity);
    }

    // Sort by overdue months (most overdue first), then by overdue amount
    defaulterList.sort((a, b) => b.overdueMonths - a.overdueMonths || b.overdueAmount - a.overdueAmount);

    const total = defaulterList.length;
    const paginated = defaulterList.slice((page - 1) * limit, page * limit);

    res.json({
      defaulters: paginated,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      session: {
        sessionYear: session.sessionYear,
        startMonth: session.startMonth,
        endMonth: session.endMonth,
        totalMonths: session.getTotalMonths(),
        elapsedMonths: getElapsedMonths(session),
      },
      summary: {
        totalDefaulters: total,
        totalOverdue: defaulterList.reduce((s, d) => s + d.overdueAmount, 0),
        highSeverity: defaulterList.filter((s) => s.severity === 'high').length,
        mediumSeverity: defaulterList.filter((s) => s.severity === 'medium').length,
        lowSeverity: defaulterList.filter((s) => s.severity === 'low').length,
      },
    });
  } catch (error) {
    console.error('Get defaulters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get defaulter stats summary
 * @route   GET /api/defaulters/stats
 */
export const getDefaulterStats = async (req, res) => {
  try {
    let session = await SessionSettings.findOne({ isActive: true });
    if (!session) {
      return res.json({ classWise: [], overall: { totalDefaulters: 0, totalOverdue: 0 } });
    }

    const students = await Student.find({})
      .select('className section feesStructure feesPaid');

    // Group by class-section
    const classMap = {};
    let totalDefaulters = 0;
    let totalOverdue = 0;

    students.forEach((s) => {
      const monthly = computeMonthlyInfo(s, session);
      if (monthly.overdueMonths <= 0) return;

      const key = `${s.className}-${s.section}`;
      if (!classMap[key]) {
        classMap[key] = {
          _id: { className: s.className, section: s.section },
          count: 0,
          totalOverdue: 0,
          tuitionPending: 0,
          transportPending: 0,
        };
      }
      classMap[key].count++;
      classMap[key].totalOverdue += monthly.overdueAmount;
      classMap[key].tuitionPending += (s.feesLeft?.tuitionLeft || 0);
      classMap[key].transportPending += (s.feesLeft?.transportLeft || 0);

      totalDefaulters++;
      totalOverdue += monthly.overdueAmount;
    });

    const classWise = Object.values(classMap).sort(
      (a, b) => a._id.className.localeCompare(b._id.className) || a._id.section.localeCompare(b._id.section)
    );

    res.json({
      classWise,
      overall: { totalDefaulters, totalOverdue },
    });
  } catch (error) {
    console.error('Defaulter stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Export defaulters list
 * @route   GET /api/defaulters/export
 */
export const exportDefaulters = async (req, res) => {
  try {
    const { className, section, format = 'excel' } = req.query;

    let session = await SessionSettings.findOne({ isActive: true });
    if (!session) {
      return res.status(400).json({ message: 'No active session found. Please configure session settings first.' });
    }

    const query = {};
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();

    const students = await Student.find(query)
      .select('uid studentName fatherWhatsapp className section feesStructure feesPaid feesLeft')
      .sort({ 'feesLeft.totalLeft': -1 });

    const rows = students
      .map((s) => {
        const monthly = computeMonthlyInfo(s, session);
        if (monthly.overdueMonths <= 0) return null;

        return {
          uid: s.uid,
          studentName: s.studentName,
          className: s.className,
          section: s.section,
          phone: s.fatherWhatsapp || 'N/A',
          monthlyFee: monthly.monthlyTotal,
          overdueMonths: monthly.overdueMonths,
          overdueAmount: monthly.overdueAmount,
          totalFees: s.feesStructure.totalFees,
          totalPaid: s.feesPaid.totalPaid,
          totalLeft: s.feesLeft.totalLeft,
        };
      })
      .filter(Boolean);

    const columns = [
      { header: 'UID', key: 'uid', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Class', key: 'className', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'WhatsApp', key: 'phone', width: 14 },
      { header: 'Monthly Fee (₹)', key: 'monthlyFee', width: 14 },
      { header: 'Overdue Months', key: 'overdueMonths', width: 14 },
      { header: 'Overdue Amt (₹)', key: 'overdueAmount', width: 16 },
      { header: 'Total Fees (₹)', key: 'totalFees', width: 14 },
      { header: 'Paid (₹)', key: 'totalPaid', width: 14 },
      { header: 'Total Left (₹)', key: 'totalLeft', width: 16 },
    ];

    const totalOverdue = rows.reduce((s, r) => s + r.overdueAmount, 0);

    if (format === 'excel') {
      const buffer = await generateExcelReport({
        title: `Fee Defaulters - ${session.sessionYear}`,
        subtitle: `${rows.length} defaulters | Total Monthly Overdue: ${fmt(totalOverdue)}`,
        columns,
        rows,
        sheetName: 'Defaulters',
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Fee_Defaulters.xlsx');
      return res.send(buffer);
    }

    // PDF
    const pdfBuffer = await buildPDF((doc) => {
      doc.fontSize(22).font('Helvetica-Bold').text('Rudrapur Public School', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text(`FEE DEFAULTERS - ${session.sessionYear}`, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text(`${rows.length} defaulters | Total Monthly Overdue: ${fmt(totalOverdue)}`, { align: 'center' }).fillColor('#000');
      doc.moveDown(0.5);
      doc.strokeColor('#333').lineWidth(1.5).moveTo(50, doc.y).lineTo(742, doc.y).stroke();
      doc.moveDown(1);

      doc.fontSize(8);
      let y = doc.y;
      const cw = [55, 110, 40, 70, 80, 80, 70, 80];
      const h = ['UID', 'Name', 'Class', 'Monthly Fee', 'Overdue Months', 'Overdue Amt', 'Total Paid', 'Total Left'];
      doc.font('Helvetica-Bold');
      let xp = 50;
      h.forEach((hdr, i) => { doc.text(hdr, xp, y, { width: cw[i] }); xp += cw[i]; });
      y += 14;
      doc.moveTo(50, y).lineTo(742, y).stroke();
      y += 4;

      doc.font('Helvetica').fontSize(7);
      rows.forEach((r) => {
        if (y > 530) { doc.addPage(); y = 50; }
        xp = 50;
        [r.uid, r.studentName, `${r.className}-${r.section}`, fmt(r.monthlyFee), `${r.overdueMonths} month(s)`, fmt(r.overdueAmount), fmt(r.totalPaid), fmt(r.totalLeft)].forEach((v, i) => {
          doc.text(String(v), xp, y, { width: cw[i] }); xp += cw[i];
        });
        y += 12;
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Fee_Defaulters.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Export defaulters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
