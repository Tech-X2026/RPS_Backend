import crypto from 'crypto';
import Razorpay from 'razorpay';
import Student from '../models/Student.js';
import PaymentLink from '../models/PaymentLink.js';
import generateReceipt from '../utils/pdfReceipt.js';
import { sendReceiptEmail } from '../utils/sendEmail.js';

// Initialize Razorpay
const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

/**
 * @desc    Create payment order and generate payment link
 * @route   POST /api/payment/create-order
 * @access  Private (Admin)
 */
export const createOrder = async (req, res) => {
  try {
    const { studentId, paymentType, tuitionAmount, transportAmount, registrationAmount, admissionAmount, developmentAmount, schoolKitAmount } = req.body;

    if (!studentId || !paymentType) {
      return res.status(400).json({
        message: 'Student ID and payment type are required',
      });
    }

    // Validate payment type
    if (!['tuition', 'transport', 'combined', 'registration', 'admission', 'development', 'schoolKit'].includes(paymentType)) {
      return res.status(400).json({
        message: 'Invalid payment type',
      });
    }

    // Find student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let finalTuitionAmount = 0;
    let finalTransportAmount = 0;

    let finalRegistrationAmount = 0;
    let finalAdmissionAmount = 0;
    let finalDevelopmentAmount = 0;
    let finalSchoolKitAmount = 0;

    // Validate and calculate amounts based on payment type
    switch (paymentType) {
      case 'tuition': {
        if (student.feesLeft.tuitionLeft <= 0) return res.status(400).json({ message: 'Tuition fees are fully paid.' });
        finalTuitionAmount = Number(tuitionAmount) || 0;
        if (finalTuitionAmount <= 0) return res.status(400).json({ message: 'Tuition amount must be > 0' });
        if (finalTuitionAmount > student.feesLeft.tuitionLeft) return res.status(400).json({ message: 'Exceeds remaining tuition' });
        break;
      }
      case 'transport': {
        if (student.feesLeft.transportLeft <= 0) return res.status(400).json({ message: 'Transport fees are fully paid.' });
        finalTransportAmount = Number(transportAmount) || 0;
        if (finalTransportAmount <= 0) return res.status(400).json({ message: 'Transport amount must be > 0' });
        if (finalTransportAmount > student.feesLeft.transportLeft) return res.status(400).json({ message: 'Exceeds remaining transport' });
        break;
      }
      case 'registration': {
        if (student.feesLeft.registrationLeft <= 0) return res.status(400).json({ message: 'Registration fees are fully paid.' });
        finalRegistrationAmount = Number(registrationAmount) || 0;
        if (finalRegistrationAmount <= 0) return res.status(400).json({ message: 'Registration amount must be > 0' });
        if (finalRegistrationAmount > student.feesLeft.registrationLeft) return res.status(400).json({ message: 'Exceeds remaining registration' });
        break;
      }
      case 'admission': {
        if (student.feesLeft.admissionLeft <= 0) return res.status(400).json({ message: 'Admission fees are fully paid.' });
        finalAdmissionAmount = Number(admissionAmount) || 0;
        if (finalAdmissionAmount <= 0) return res.status(400).json({ message: 'Admission amount must be > 0' });
        if (finalAdmissionAmount > student.feesLeft.admissionLeft) return res.status(400).json({ message: 'Exceeds remaining admission' });
        break;
      }
      case 'development': {
        if (student.feesLeft.developmentLeft <= 0) return res.status(400).json({ message: 'Development fees are fully paid.' });
        finalDevelopmentAmount = Number(developmentAmount) || 0;
        if (finalDevelopmentAmount <= 0) return res.status(400).json({ message: 'Development amount must be > 0' });
        if (finalDevelopmentAmount > student.feesLeft.developmentLeft) return res.status(400).json({ message: 'Exceeds remaining development' });
        break;
      }
      case 'schoolKit': {
        if (student.feesLeft.schoolKitLeft <= 0) return res.status(400).json({ message: 'School Kit fees are fully paid.' });
        finalSchoolKitAmount = Number(schoolKitAmount) || 0;
        if (finalSchoolKitAmount <= 0) return res.status(400).json({ message: 'School Kit amount must be > 0' });
        if (finalSchoolKitAmount > student.feesLeft.schoolKitLeft) return res.status(400).json({ message: 'Exceeds remaining school kit' });
        break;
      }
      case 'combined': {
        if (student.feesLeft.totalLeft <= 0) {
          return res.status(400).json({ message: 'All fees are fully paid. No payment needed.' });
        }
        finalTuitionAmount = Number(tuitionAmount) || 0;
        finalTransportAmount = Number(transportAmount) || 0;
        finalRegistrationAmount = Number(registrationAmount) || 0;
        finalAdmissionAmount = Number(admissionAmount) || 0;
        finalDevelopmentAmount = Number(developmentAmount) || 0;
        finalSchoolKitAmount = Number(schoolKitAmount) || 0;

        if (finalTuitionAmount <= 0 && finalTransportAmount <= 0 && finalRegistrationAmount <= 0 && finalAdmissionAmount <= 0 && finalDevelopmentAmount <= 0 && finalSchoolKitAmount <= 0) {
          return res.status(400).json({ message: 'At least one fee amount must be greater than 0' });
        }

        if (finalTuitionAmount > student.feesLeft.tuitionLeft) return res.status(400).json({ message: 'Exceeds remaining tuition' });
        if (finalTransportAmount > student.feesLeft.transportLeft) return res.status(400).json({ message: 'Exceeds remaining transport' });
        if (finalRegistrationAmount > student.feesLeft.registrationLeft) return res.status(400).json({ message: 'Exceeds remaining registration' });
        if (finalAdmissionAmount > student.feesLeft.admissionLeft) return res.status(400).json({ message: 'Exceeds remaining admission' });
        if (finalDevelopmentAmount > student.feesLeft.developmentLeft) return res.status(400).json({ message: 'Exceeds remaining development' });
        if (finalSchoolKitAmount > student.feesLeft.schoolKitLeft) return res.status(400).json({ message: 'Exceeds remaining school kit' });
        break;
      }
    }

    const totalAmount = finalTuitionAmount + finalTransportAmount + finalRegistrationAmount + finalAdmissionAmount + finalDevelopmentAmount + finalSchoolKitAmount;

    if (totalAmount <= 0) {
      return res.status(400).json({ message: 'Total amount must be greater than 0' });
    }

    // Create Razorpay order
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: totalAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: `RPS-${student.uid}-${Date.now()}`,
      notes: {
        studentId: student._id.toString(),
        studentName: student.studentName,
        uid: student.uid,
        paymentType,
      },
    });

    // Create payment link record
    const paymentLink = await PaymentLink.create({
      studentId: student._id,
      paymentType,
      tuitionAmount: finalTuitionAmount,
      transportAmount: finalTransportAmount,
      registrationAmount: finalRegistrationAmount,
      admissionAmount: finalAdmissionAmount,
      developmentAmount: finalDevelopmentAmount,
      schoolKitAmount: finalSchoolKitAmount,
      totalAmount,
      razorpayOrderId: order.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    const linkUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/pay/${paymentLink._id}`;

    res.status(201).json({
      paymentLinkId: paymentLink._id,
      paymentLink: linkUrl,
      orderId: order.id,
      amount: totalAmount,
      tuitionAmount: finalTuitionAmount,
      transportAmount: finalTransportAmount,
      registrationAmount: finalRegistrationAmount,
      admissionAmount: finalAdmissionAmount,
      developmentAmount: finalDevelopmentAmount,
      schoolKitAmount: finalSchoolKitAmount,
      paymentType,
      studentName: student.studentName,
      uid: student.uid,
      fatherWhatsapp: student.fatherWhatsapp,
      expiresAt: paymentLink.expiresAt,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Verify Razorpay payment and update student fees
 * @route   POST /api/payment/verify
 * @access  Public
 */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentLinkId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentLinkId) {
      return res.status(400).json({ message: 'Missing payment verification data' });
    }

    // Step 1: Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: 'Payment verification failed. Invalid signature.',
      });
    }

    // Step 2: Find payment link
    const paymentLink = await PaymentLink.findById(paymentLinkId);
    if (!paymentLink) {
      return res.status(404).json({ message: 'Payment link not found' });
    }

    if (paymentLink.paymentStatus === 'completed') {
      return res.status(400).json({ message: 'Payment already processed' });
    }

    // Step 3: Find student
    const student = await Student.findById(paymentLink.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Step 4: Update student fees based on payment type
    const { paymentType, tuitionAmount, transportAmount, registrationAmount, admissionAmount, developmentAmount, schoolKitAmount, totalAmount } = paymentLink;

    if (paymentType === 'tuition' || paymentType === 'combined') {
      student.feesPaid.tuitionPaid += tuitionAmount;
    }
    if (paymentType === 'transport' || paymentType === 'combined') {
      student.feesPaid.transportPaid += transportAmount;
    }
    if (paymentType === 'registration' || paymentType === 'combined') {
      student.feesPaid.registrationPaid += registrationAmount;
    }
    if (paymentType === 'admission' || paymentType === 'combined') {
      student.feesPaid.admissionPaid += admissionAmount;
    }
    if (paymentType === 'development' || paymentType === 'combined') {
      student.feesPaid.developmentPaid += developmentAmount;
    }
    if (paymentType === 'schoolKit' || paymentType === 'combined') {
      student.feesPaid.schoolKitPaid += schoolKitAmount;
    }

    // Step 5: Add to payment history
    student.paymentHistory.push({
      paymentType,
      tuitionAmount,
      transportAmount,
      registrationAmount,
      admissionAmount,
      developmentAmount,
      schoolKitAmount,
      totalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: 'success',
      paidAt: new Date(),
    });

    const paymentIndex = student.paymentHistory.length - 1;

    // Save student (pre-save hook will recalculate totals and lefts)
    await student.save();

    // Step 6: Update payment link status
    paymentLink.paymentStatus = 'completed';
    await paymentLink.save();

    // Step 7: Generate PDF receipt and send email (async, non-blocking)
    const receiptData = {
      studentName: student.studentName,
      uid: student.uid,
      className: student.className,
      section: student.section,
      paymentType,
      tuitionAmount,
      transportAmount,
      registrationAmount,
      admissionAmount,
      developmentAmount,
      schoolKitAmount,
      totalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      paidAt: new Date(),
    };

    // Generate receipt and email asynchronously
    generateReceipt(receiptData)
      .then((pdfBuffer) => {
        if (student.fatherEmail) {
          sendReceiptEmail(student.fatherEmail, student.studentName, receiptData, pdfBuffer)
            .catch((err) => console.error('Receipt email error:', err));
        }
      })
      .catch((err) => console.error('Receipt generation error:', err));

    res.json({
      message: 'Payment verified and fees updated successfully',
      student: {
        _id: student._id.toString(),
        name: student.studentName,
        uid: student.uid,
        feesPaid: student.feesPaid,
        feesLeft: student.feesLeft,
      },
      payment: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: totalAmount,
        paymentType,
        paymentIndex,
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get payment link details (for public payment page)
 * @route   GET /api/payment/link/:id
 * @access  Public
 */
export const getPaymentLink = async (req, res) => {
  try {
    const paymentLink = await PaymentLink.findById(req.params.id).populate(
      'studentId',
      'studentName uid className section feesLeft feesStructure'
    );

    if (!paymentLink) {
      return res.status(404).json({ message: 'Payment link not found' });
    }

    // Check if expired
    if (new Date() > paymentLink.expiresAt) {
      paymentLink.paymentStatus = 'expired';
      await paymentLink.save();
      return res.status(410).json({ message: 'Payment link has expired' });
    }

    // Check if already completed
    if (paymentLink.paymentStatus === 'completed') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    res.json({
      _id: paymentLink._id,
      student: paymentLink.studentId,
      paymentType: paymentLink.paymentType,
      tuitionAmount: paymentLink.tuitionAmount,
      transportAmount: paymentLink.transportAmount,
      registrationAmount: paymentLink.registrationAmount,
      admissionAmount: paymentLink.admissionAmount,
      developmentAmount: paymentLink.developmentAmount,
      schoolKitAmount: paymentLink.schoolKitAmount,
      totalAmount: paymentLink.totalAmount,
      razorpayOrderId: paymentLink.razorpayOrderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      expiresAt: paymentLink.expiresAt,
      paymentStatus: paymentLink.paymentStatus,
    });
  } catch (error) {
    console.error('Get payment link error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Payment link not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Generate and download PDF receipt for a payment
 * @route   GET /api/payment/receipt/:studentId/:paymentIndex
 * @access  Public
 */
export const downloadReceipt = async (req, res) => {
  try {
    const { studentId, paymentIndex } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const payment = student.paymentHistory[parseInt(paymentIndex)];
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    const receiptData = {
      studentName: student.studentName,
      uid: student.uid,
      className: student.className,
      section: student.section,
      paymentType: payment.paymentType,
      tuitionAmount: payment.tuitionAmount,
      transportAmount: payment.transportAmount,
      registrationAmount: payment.registrationAmount,
      admissionAmount: payment.admissionAmount,
      developmentAmount: payment.developmentAmount,
      schoolKitAmount: payment.schoolKitAmount,
      totalAmount: payment.totalAmount,
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      paidAt: payment.paidAt,
    };

    const pdfBuffer = await generateReceipt(receiptData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Receipt_${payment.paymentId}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download receipt error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Record manual backdated fee entry
 * @route   POST /api/payment/manual-entry
 * @access  Private (Admin)
 */
export const manualFeeEntry = async (req, res) => {
  try {
    const { studentId, modeOfPayment, entries } = req.body;

    if (!studentId || !modeOfPayment || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'Invalid data provided' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const statusMap = {
      'Cash': 'cash',
      'Online': 'success',
    };
    const paymentStatus = statusMap[modeOfPayment] || 'success';

    let totalRecorded = 0;

    for (const entry of entries) {
      const { feeType, amount, paidAt } = entry;
      const parsedAmount = Number(amount);
      if (parsedAmount <= 0) continue;

      const dateObj = paidAt ? new Date(paidAt) : new Date();

      // Ensure we have properties setup on the payment history schema
      const paymentRecord = {
        paymentType: feeType,
        totalAmount: parsedAmount,
        paymentId: `MANUAL-${feeType.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: `MANUAL-${modeOfPayment.toUpperCase()}`,
        status: paymentStatus,
        paidAt: dateObj,
      };

      // Set individual amounts
      if (feeType === 'tuition') {
        paymentRecord.tuitionAmount = parsedAmount;
        student.feesPaid.tuitionPaid += parsedAmount;
      } else if (feeType === 'transport') {
        paymentRecord.transportAmount = parsedAmount;
        student.feesPaid.transportPaid += parsedAmount;
      } else if (feeType === 'registration') {
        paymentRecord.registrationAmount = parsedAmount;
        student.feesPaid.registrationPaid += parsedAmount;
      } else if (feeType === 'admission') {
        paymentRecord.admissionAmount = parsedAmount;
        student.feesPaid.admissionPaid += parsedAmount;
      } else if (feeType === 'development') {
        paymentRecord.developmentAmount = parsedAmount;
        student.feesPaid.developmentPaid += parsedAmount;
      } else if (feeType === 'schoolKit') {
        paymentRecord.schoolKitAmount = parsedAmount;
        student.feesPaid.schoolKitPaid += parsedAmount;
      }

      student.paymentHistory.push(paymentRecord);
      totalRecorded += parsedAmount;
    }

    // Recalculate will be handled by pre-save hook, but let's manually trigger it by saving
    await student.save();

    res.status(200).json({
      message: 'Manual fees recorded successfully',
      totalRecorded,
    });
  } catch (error) {
    console.error('Manual fee entry error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
