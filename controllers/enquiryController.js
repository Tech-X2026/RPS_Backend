import Enquiry from '../models/Enquiry.js';

/**
 * @desc    Create new enquiry
 * @route   POST /api/enquiries
 * @access  Public
 */
export const createEnquiry = async (req, res) => {
  try {
    const { parentName, email, phone, studentName, grade, message } = req.body;

    if (!parentName || !email || !phone || !studentName || !grade) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const enquiry = new Enquiry({
      parentName,
      email,
      phone,
      studentName,
      grade,
      message: message || '',
    });

    await enquiry.save();

    res.status(201).json({ message: 'Enquiry submitted successfully' });
  } catch (error) {
    console.error('Create enquiry error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get new enquiry count
 * @route   GET /api/enquiries/new/count
 * @access  Admin
 */
export const getNewEnquiryCount = async (req, res) => {
  try {
    const count = await Enquiry.countDocuments({ status: 'new' });
    res.json({ count });
  } catch (error) {
    console.error('Get new enquiry count error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all enquiries
 * @route   GET /api/enquiries
 * @access  Admin
 */
export const getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (error) {
    console.error('Get enquiries error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update enquiry status
 * @route   PUT /api/enquiries/:id
 * @access  Admin
 */
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    enquiry.status = status;
    const updatedEnquiry = await enquiry.save();

    res.json(updatedEnquiry);
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete enquiry
 * @route   DELETE /api/enquiries/:id
 * @access  Admin
 */
export const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    await enquiry.deleteOne();
    res.json({ message: 'Enquiry removed' });
  } catch (error) {
    console.error('Delete enquiry error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
