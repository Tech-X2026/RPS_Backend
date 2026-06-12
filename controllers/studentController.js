import Student from '../models/Student.js';
import FeesStructure from '../models/FeesStructure.js';
import generateUID from '../utils/generateUID.js';

/**
 * @desc    Create a new student
 * @route   POST /api/student/create
 * @access  Private
 */
export const createStudent = async (req, res) => {
  try {
    const { studentName, fatherEmail, fatherWhatsapp, address, className, section, customFees } = req.body;

    if (!studentName || !className || !section) {
      return res.status(400).json({
        message: 'Student name, class, and section are required',
      });
    }

    // Generate unique UID
    const uid = await generateUID(className, section);

    // Fetch fee structure for this class-section
    const feeStructure = await FeesStructure.findOne({
      className,
      section: section.toUpperCase(),
    });

    // Set fees based on structure (or 0 if none exists)
    let tuitionFees = feeStructure ? feeStructure.tuitionFees : 0;
    let transportFees = feeStructure ? feeStructure.transportFees : 0;
    let registrationFee = feeStructure ? feeStructure.registrationFee : 0;
    let admissionFee = feeStructure ? feeStructure.admissionFee : 0;
    let developmentFee = feeStructure ? feeStructure.developmentFee : 0;
    let schoolKitFee = feeStructure ? feeStructure.schoolKitFee : 0;

    // Apply custom fees if provided
    const studentCustomFees = {
      isCustom: false,
      concessionType: 'none',
      concessionValue: 0,
      reason: '',
    };

    if (customFees && customFees.isCustom) {
      studentCustomFees.isCustom = true;
      if (customFees.tuitionFees !== undefined) {
        studentCustomFees.tuitionFees = Number(customFees.tuitionFees);
        tuitionFees = Number(customFees.tuitionFees);
      }
      if (customFees.transportFees !== undefined) {
        studentCustomFees.transportFees = Number(customFees.transportFees);
        transportFees = Number(customFees.transportFees);
      }
      if (customFees.registrationFee !== undefined) {
        studentCustomFees.registrationFee = Number(customFees.registrationFee);
        registrationFee = Number(customFees.registrationFee);
      }
      if (customFees.admissionFee !== undefined) {
        studentCustomFees.admissionFee = Number(customFees.admissionFee);
        admissionFee = Number(customFees.admissionFee);
      }
      if (customFees.developmentFee !== undefined) {
        studentCustomFees.developmentFee = Number(customFees.developmentFee);
        developmentFee = Number(customFees.developmentFee);
      }
      if (customFees.schoolKitFee !== undefined) {
        studentCustomFees.schoolKitFee = Number(customFees.schoolKitFee);
        schoolKitFee = Number(customFees.schoolKitFee);
      }
      if (customFees.concessionType) studentCustomFees.concessionType = customFees.concessionType;
      if (customFees.concessionValue) studentCustomFees.concessionValue = Number(customFees.concessionValue);
      if (customFees.reason) studentCustomFees.reason = customFees.reason;
    }

    const student = await Student.create({
      uid,
      studentName,
      fatherEmail: fatherEmail || '',
      fatherWhatsapp: fatherWhatsapp || '',
      address: address || '',
      className,
      section: section.toUpperCase(),
      customFees: studentCustomFees,
      feesStructure: {
        tuitionFees,
        transportFees,
        registrationFee,
        admissionFee,
        developmentFee,
        schoolKitFee,
        totalFees: tuitionFees + transportFees + registrationFee + admissionFee + developmentFee + schoolKitFee,
      },
      feesPaid: {
        tuitionPaid: 0,
        transportPaid: 0,
        registrationPaid: 0,
        admissionPaid: 0,
        developmentPaid: 0,
        schoolKitPaid: 0,
        totalPaid: 0,
      },
      feesLeft: {
        tuitionLeft: tuitionFees,
        transportLeft: transportFees,
        registrationLeft: registrationFee,
        admissionLeft: admissionFee,
        developmentLeft: developmentFee,
        schoolKitLeft: schoolKitFee,
        totalLeft: tuitionFees + transportFees + registrationFee + admissionFee + developmentFee + schoolKitFee,
      },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error('Create student error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Student UID already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all students with pagination, search, and filters
 * @route   GET /api/student/all
 * @access  Private
 */
export const getAllStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      className = '',
      section = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Search by name or UID
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by class
    if (className) {
      query.className = className;
    }

    // Filter by section
    if (section) {
      query.section = section.toUpperCase();
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-paymentHistory');

    res.json({
      students,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get single student by ID
 * @route   GET /api/student/:id
 * @access  Private
 */
export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update student
 * @route   PUT /api/student/update/:id
 * @access  Private
 */
export const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const {
      studentName,
      fatherEmail,
      fatherWhatsapp,
      address,
      className,
      section,
      // Manual fee adjustments (for cash payments)
      tuitionPaid,
      transportPaid,
      registrationPaid,
      admissionPaid,
      developmentPaid,
      schoolKitPaid,
      tuitionFees,
      transportFees,
      registrationFee,
      admissionFee,
      developmentFee,
      schoolKitFee,
      // Custom fees
      customFees,
      // Last year dues
      lastYearDues,
    } = req.body;

    // Update basic info
    if (studentName !== undefined) student.studentName = studentName;
    if (fatherEmail !== undefined) student.fatherEmail = fatherEmail;
    if (fatherWhatsapp !== undefined) student.fatherWhatsapp = fatherWhatsapp;
    if (address !== undefined) student.address = address;
    if (className !== undefined) student.className = className;
    if (section !== undefined) student.section = section.toUpperCase();

    // Manual fee structure update
    if (tuitionFees !== undefined) student.feesStructure.tuitionFees = Number(tuitionFees);
    if (transportFees !== undefined) student.feesStructure.transportFees = Number(transportFees);
    if (registrationFee !== undefined) student.feesStructure.registrationFee = Number(registrationFee);
    if (admissionFee !== undefined) student.feesStructure.admissionFee = Number(admissionFee);
    if (developmentFee !== undefined) student.feesStructure.developmentFee = Number(developmentFee);
    if (schoolKitFee !== undefined) student.feesStructure.schoolKitFee = Number(schoolKitFee);

    // Manual fee paid update (for cash payments)
    if (tuitionPaid !== undefined) {
      const newTuitionPaid = Number(tuitionPaid);
      if (newTuitionPaid > student.feesStructure.tuitionFees) {
        return res.status(400).json({
          message: 'Tuition paid cannot exceed total tuition fees',
        });
      }
      // Record cash payment in history if amount changed
      if (newTuitionPaid !== student.feesPaid.tuitionPaid) {
        const diff = newTuitionPaid - student.feesPaid.tuitionPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'tuition',
            tuitionAmount: diff,
            transportAmount: 0,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.tuitionPaid = newTuitionPaid;
    }

    if (transportPaid !== undefined) {
      const newTransportPaid = Number(transportPaid);
      if (newTransportPaid > student.feesStructure.transportFees) {
        return res.status(400).json({
          message: 'Transport paid cannot exceed total transport fees',
        });
      }
      // Record cash payment in history if amount changed
      if (newTransportPaid !== student.feesPaid.transportPaid) {
        const diff = newTransportPaid - student.feesPaid.transportPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'transport',
            tuitionAmount: 0,
            transportAmount: diff,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.transportPaid = newTransportPaid;
    }

    if (registrationPaid !== undefined) {
      const newRegistrationPaid = Number(registrationPaid);
      if (newRegistrationPaid > student.feesStructure.registrationFee) {
        return res.status(400).json({ message: 'Registration paid cannot exceed total registration fee' });
      }
      if (newRegistrationPaid !== student.feesPaid.registrationPaid) {
        const diff = newRegistrationPaid - student.feesPaid.registrationPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'registration',
            registrationAmount: diff,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.registrationPaid = newRegistrationPaid;
    }

    if (admissionPaid !== undefined) {
      const newAdmissionPaid = Number(admissionPaid);
      if (newAdmissionPaid > student.feesStructure.admissionFee) {
        return res.status(400).json({ message: 'Admission paid cannot exceed total admission fee' });
      }
      if (newAdmissionPaid !== student.feesPaid.admissionPaid) {
        const diff = newAdmissionPaid - student.feesPaid.admissionPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'admission',
            admissionAmount: diff,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.admissionPaid = newAdmissionPaid;
    }

    if (developmentPaid !== undefined) {
      const newDevelopmentPaid = Number(developmentPaid);
      if (newDevelopmentPaid > student.feesStructure.developmentFee) {
        return res.status(400).json({ message: 'Development paid cannot exceed total development fee' });
      }
      if (newDevelopmentPaid !== student.feesPaid.developmentPaid) {
        const diff = newDevelopmentPaid - student.feesPaid.developmentPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'development',
            developmentAmount: diff,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.developmentPaid = newDevelopmentPaid;
    }

    if (schoolKitPaid !== undefined) {
      const newSchoolKitPaid = Number(schoolKitPaid);
      if (newSchoolKitPaid > student.feesStructure.schoolKitFee) {
        return res.status(400).json({ message: 'School Kit paid cannot exceed total school kit fee' });
      }
      if (newSchoolKitPaid !== student.feesPaid.schoolKitPaid) {
        const diff = newSchoolKitPaid - student.feesPaid.schoolKitPaid;
        if (diff > 0) {
          student.paymentHistory.push({
            paymentType: 'schoolKit',
            schoolKitAmount: diff,
            totalAmount: diff,
            paymentId: `CASH-${Date.now()}`,
            orderId: `CASH-${Date.now()}`,
            status: 'cash',
            paidAt: new Date(),
          });
        }
      }
      student.feesPaid.schoolKitPaid = newSchoolKitPaid;
    }

    // Custom fees update
    if (customFees !== undefined) {
      if (customFees.isCustom !== undefined) student.customFees.isCustom = customFees.isCustom;
      if (customFees.tuitionFees !== undefined) student.customFees.tuitionFees = Number(customFees.tuitionFees);
      if (customFees.transportFees !== undefined) student.customFees.transportFees = Number(customFees.transportFees);
      if (customFees.concessionType !== undefined) student.customFees.concessionType = customFees.concessionType;
      if (customFees.concessionValue !== undefined) student.customFees.concessionValue = Number(customFees.concessionValue);
      if (customFees.reason !== undefined) student.customFees.reason = customFees.reason;
    }

    // Last year dues update
    if (lastYearDues !== undefined) {
      if (lastYearDues.tuition !== undefined) student.lastYearDues.tuition = Number(lastYearDues.tuition);
      if (lastYearDues.transport !== undefined) student.lastYearDues.transport = Number(lastYearDues.transport);
      if (lastYearDues.fromYear !== undefined) student.lastYearDues.fromYear = lastYearDues.fromYear;
    }

    // Save will auto-recalculate totals via pre-save hook
    await student.save();

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete student
 * @route   DELETE /api/student/delete/:id
 * @access  Private
 */
export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Export all students as CSV
 * @route   GET /api/student/export
 * @access  Private
 */
export const exportStudents = async (req, res) => {
  try {
    const students = await Student.find({}).sort({ className: 1, section: 1, uid: 1 });

    // CSV header
    const headers = [
      'UID',
      'Student Name',
      'Father Email',
      'Father WhatsApp',
      'Address',
      'Class',
      'Section',
      'Tuition Fees',
      'Transport Fees',
      'Total Fees',
      'Tuition Paid',
      'Transport Paid',
      'Total Paid',
      'Tuition Left',
      'Transport Left',
      'Total Left',
    ];

    const csvRows = [headers.join(',')];

    for (const s of students) {
      const row = [
        s.uid,
        `"${s.studentName}"`,
        s.fatherEmail || '',
        s.fatherWhatsapp || '',
        `"${(s.address || '').replace(/"/g, '""')}"`,
        s.className,
        s.section,
        s.feesStructure.tuitionFees,
        s.feesStructure.transportFees,
        s.feesStructure.totalFees,
        s.feesPaid.tuitionPaid,
        s.feesPaid.transportPaid,
        s.feesPaid.totalPaid,
        s.feesLeft.tuitionLeft,
        s.feesLeft.transportLeft,
        s.feesLeft.totalLeft,
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get dashboard stats
 * @route   GET /api/student/stats
 * @access  Private
 */
export const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();

    // Aggregate fee stats
    const feeStats = await Student.aggregate([
      {
        $group: {
          _id: null,
          totalFeesCollected: { $sum: '$feesPaid.totalPaid' },
          totalPendingFees: { $sum: '$feesLeft.totalLeft' },
          totalTuitionCollected: { $sum: '$feesPaid.tuitionPaid' },
          totalTransportCollected: { $sum: '$feesPaid.transportPaid' },
        },
      },
    ]);

    // Today's collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPayments = await Student.aggregate([
      { $unwind: '$paymentHistory' },
      {
        $match: {
          'paymentHistory.paidAt': { $gte: today, $lt: tomorrow },
          'paymentHistory.status': { $in: ['success', 'cash'] },
        },
      },
      {
        $group: {
          _id: null,
          todayCollection: { $sum: '$paymentHistory.totalAmount' },
          todayTransactions: { $sum: 1 },
        },
      },
    ]);

    // Recent payments (last 10)
    const recentPayments = await Student.aggregate([
      { $unwind: '$paymentHistory' },
      { $match: { 'paymentHistory.status': { $in: ['success', 'cash'] } } },
      { $sort: { 'paymentHistory.paidAt': -1 } },
      { $limit: 10 },
      {
        $project: {
          studentName: 1,
          uid: 1,
          className: 1,
          section: 1,
          payment: '$paymentHistory',
        },
      },
    ]);

    // Students with fully paid fees
    const fullyPaid = await Student.countDocuments({
      'feesLeft.totalLeft': 0,
      'feesStructure.totalFees': { $gt: 0 },
    });

    // Class-wise collection summary
    const classWiseStats = await Student.aggregate([
      {
        $group: {
          _id: { className: '$className', section: '$section' },
          studentCount: { $sum: 1 },
          totalCollected: { $sum: '$feesPaid.totalPaid' },
          totalPending: { $sum: '$feesLeft.totalLeft' },
        },
      },
      { $sort: { '_id.className': 1, '_id.section': 1 } },
    ]);

    res.json({
      totalStudents,
      totalFeesCollected: feeStats[0]?.totalFeesCollected || 0,
      totalPendingFees: feeStats[0]?.totalPendingFees || 0,
      totalTuitionCollected: feeStats[0]?.totalTuitionCollected || 0,
      totalTransportCollected: feeStats[0]?.totalTransportCollected || 0,
      todayCollection: todayPayments[0]?.todayCollection || 0,
      todayTransactions: todayPayments[0]?.todayTransactions || 0,
      fullyPaid,
      recentPayments,
      classWiseStats,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
