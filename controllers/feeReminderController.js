import Student from '../models/Student.js';
import SessionSettings from '../models/SessionSettings.js';
import { generateFeeReminderLink } from '../utils/whatsapp.js';

/**
 * Helper: Calculate elapsed months from session start
 */
const getElapsedMonths = (session) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const startYear = parseInt(session.sessionYear.split('-')[0]);
  const totalMonths = session.getTotalMonths();

  let elapsed = (currentYear - startYear) * 12 + (currentMonth - session.startMonth) + 1;
  if (elapsed < 0) elapsed = 0;
  if (elapsed > totalMonths) elapsed = totalMonths;
  return elapsed;
};

/**
 * @desc    Get students with pending fees (with monthly info)
 * @route   GET /api/fee-reminder/pending
 * @access  Admin only
 */
export const getPendingFeeStudents = async (req, res) => {
  try {
    const { className, section, minAmount } = req.query;

    // Get active session
    let session = await SessionSettings.findOne({ isActive: true });
    if (!session) {
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

    const totalMonths = session.getTotalMonths();
    const elapsedMonths = getElapsedMonths(session);

    const query = { 'feesLeft.totalLeft': { $gt: 0 } };
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();
    if (minAmount) query['feesLeft.totalLeft'] = { $gte: Number(minAmount) };

    const students = await Student.find(query)
      .select('uid studentName fatherWhatsapp fatherEmail className section feesStructure feesPaid feesLeft')
      .sort({ 'feesLeft.totalLeft': -1 });

    // Enrich with monthly info
    const enriched = students.map((s) => {
      const doc = s.toObject();
      const monthlyTuition = totalMonths > 0 ? Math.round((s.feesStructure.tuitionFees || 0) / totalMonths) : 0;
      const monthlyTransport = totalMonths > 0 ? Math.round((s.feesStructure.transportFees || 0) / totalMonths) : 0;
      const monthlyTotal = monthlyTuition + monthlyTransport;

      const expectedPayment = monthlyTotal * elapsedMonths;
      const regularPaid = (s.feesPaid?.tuitionPaid || 0) + (s.feesPaid?.transportPaid || 0);
      const overdueAmount = Math.max(0, expectedPayment - regularPaid);
      const overdueMonths = monthlyTotal > 0 ? Math.ceil(overdueAmount / monthlyTotal) : 0;
      const monthsCovered = monthlyTotal > 0 ? Math.floor(regularPaid / monthlyTotal) : 0;

      return {
        ...doc,
        monthlyTuition,
        monthlyTransport,
        monthlyTotal,
        overdueMonths,
        overdueAmount,
        monthsCovered,
        elapsedMonths,
      };
    });

    const summary = {
      totalStudents: enriched.length,
      totalPending: enriched.reduce((sum, s) => sum + s.feesLeft.totalLeft, 0),
      totalMonthlyOverdue: enriched.reduce((sum, s) => sum + s.overdueAmount, 0),
      session: {
        sessionYear: session.sessionYear,
        totalMonths,
        elapsedMonths,
      },
    };

    res.json({ students: enriched, summary });
  } catch (error) {
    console.error('Get pending fees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Generate WhatsApp link for a single student (with monthly info)
 * @route   POST /api/fee-reminder/whatsapp-link
 * @access  Admin only
 */
export const generateWhatsAppLink = async (req, res) => {
  try {
    const { studentId, customMessage } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!student.fatherWhatsapp) {
      return res.status(400).json({ message: 'Student does not have a WhatsApp number' });
    }

    // Get session for monthly info
    let session = await SessionSettings.findOne({ isActive: true });
    let monthlyInfo = null;
    if (session) {
      const totalMonths = session.getTotalMonths();
      const elapsedMonths = getElapsedMonths(session);
      const monthlyTuition = totalMonths > 0 ? Math.round((student.feesStructure.tuitionFees || 0) / totalMonths) : 0;
      const monthlyTransport = totalMonths > 0 ? Math.round((student.feesStructure.transportFees || 0) / totalMonths) : 0;
      const monthlyTotal = monthlyTuition + monthlyTransport;
      const regularPaid = (student.feesPaid?.tuitionPaid || 0) + (student.feesPaid?.transportPaid || 0);
      const overdueAmount = Math.max(0, (monthlyTotal * elapsedMonths) - regularPaid);
      const overdueMonths = monthlyTotal > 0 ? Math.ceil(overdueAmount / monthlyTotal) : 0;

      monthlyInfo = { monthlyTuition, monthlyTransport, monthlyTotal, overdueMonths, overdueAmount };
    }

    const link = generateFeeReminderLink(
      student.fatherWhatsapp,
      student.studentName,
      `${student.className}-${student.section}`,
      student.feesLeft.totalLeft,
      customMessage || '',
      monthlyInfo
    );

    res.json({
      studentName: student.studentName,
      uid: student.uid,
      pendingAmount: student.feesLeft.totalLeft,
      phone: student.fatherWhatsapp,
      ...link,
    });
  } catch (error) {
    console.error('Generate WhatsApp link error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Generate bulk WhatsApp links for all pending fee students
 * @route   POST /api/fee-reminder/bulk-links
 * @access  Admin only
 */
export const generateBulkLinks = async (req, res) => {
  try {
    const { className, section, customMessage } = req.body;

    const query = { 'feesLeft.totalLeft': { $gt: 0 } };
    if (className) query.className = className;
    if (section) query.section = section.toUpperCase();
    query.fatherWhatsapp = { $exists: true, $ne: '' };

    const students = await Student.find(query)
      .select('uid studentName fatherWhatsapp className section feesStructure feesPaid feesLeft')
      .sort({ 'feesLeft.totalLeft': -1 });

    // Get session for monthly info
    let session = await SessionSettings.findOne({ isActive: true });
    let totalMonths = 12;
    let elapsedMonths = 0;
    if (session) {
      totalMonths = session.getTotalMonths();
      elapsedMonths = getElapsedMonths(session);
    }

    const links = students.map((student) => {
      let monthlyInfo = null;
      if (session) {
        const monthlyTuition = totalMonths > 0 ? Math.round((student.feesStructure.tuitionFees || 0) / totalMonths) : 0;
        const monthlyTransport = totalMonths > 0 ? Math.round((student.feesStructure.transportFees || 0) / totalMonths) : 0;
        const monthlyTotal = monthlyTuition + monthlyTransport;
        const regularPaid = (student.feesPaid?.tuitionPaid || 0) + (student.feesPaid?.transportPaid || 0);
        const overdueAmount = Math.max(0, (monthlyTotal * elapsedMonths) - regularPaid);
        const overdueMonths = monthlyTotal > 0 ? Math.ceil(overdueAmount / monthlyTotal) : 0;
        monthlyInfo = { monthlyTuition, monthlyTransport, monthlyTotal, overdueMonths, overdueAmount };
      }

      const link = generateFeeReminderLink(
        student.fatherWhatsapp,
        student.studentName,
        `${student.className}-${student.section}`,
        student.feesLeft.totalLeft,
        customMessage || '',
        monthlyInfo
      );

      return {
        studentName: student.studentName,
        uid: student.uid,
        className: student.className,
        section: student.section,
        pendingAmount: student.feesLeft.totalLeft,
        phone: student.fatherWhatsapp,
        ...link,
      };
    });

    res.json({
      totalStudents: links.length,
      totalPending: links.reduce((sum, l) => sum + l.pendingAmount, 0),
      links,
    });
  } catch (error) {
    console.error('Generate bulk links error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
