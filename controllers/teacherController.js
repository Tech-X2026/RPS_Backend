import Teacher from '../models/Teacher.js';

/**
 * @desc    Create a new teacher
 * @route   POST /api/teacher/create
 * @access  Admin only
 */
export const createTeacher = async (req, res) => {
  try {
    const { name, email, phone, password, subject, qualification, monthlySalary, assignedClasses, joiningDate } = req.body;

    if (!name || !email || !phone || !password || monthlySalary === undefined) {
      return res.status(400).json({
        message: 'Name, email, phone, password, and monthly salary are required',
      });
    }

    const existing = await Teacher.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Teacher with this email already exists' });
    }

    const teacher = await Teacher.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      subject: subject || '',
      qualification: qualification || '',
      monthlySalary: Number(monthlySalary),
      assignedClasses: assignedClasses || [],
      joiningDate: joiningDate || new Date(),
    });

    // Don't return password
    const teacherObj = teacher.toObject();
    delete teacherObj.password;

    res.status(201).json(teacherObj);
  } catch (error) {
    console.error('Create teacher error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Teacher with this email already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all teachers with pagination, search, filters
 * @route   GET /api/teacher/all
 * @access  Admin only
 */
export const getAllTeachers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const total = await Teacher.countDocuments(query);
    const teachers = await Teacher.find(query)
      .select('-password')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({
      teachers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get single teacher by ID
 * @route   GET /api/teacher/:id
 * @access  Admin only
 */
export const getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('-password');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.json(teacher);
  } catch (error) {
    console.error('Get teacher error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update teacher (including salary edit by admin)
 * @route   PUT /api/teacher/update/:id
 * @access  Admin only
 */
export const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const { name, email, phone, password, subject, qualification, monthlySalary, assignedClasses, status, joiningDate } = req.body;

    if (name !== undefined) teacher.name = name;
    if (email !== undefined) teacher.email = email.toLowerCase();
    if (phone !== undefined) teacher.phone = phone;
    if (password) teacher.password = password; // Will be hashed by pre-save
    if (subject !== undefined) teacher.subject = subject;
    if (qualification !== undefined) teacher.qualification = qualification;
    if (monthlySalary !== undefined) teacher.monthlySalary = Number(monthlySalary);
    if (assignedClasses !== undefined) teacher.assignedClasses = assignedClasses;
    if (status !== undefined) teacher.status = status;
    if (joiningDate !== undefined) {
      teacher.joiningDate = joiningDate === '' ? null : joiningDate;
    }

    await teacher.save();

    const teacherObj = teacher.toObject();
    delete teacherObj.password;

    res.json(teacherObj);
  } catch (error) {
    console.error('Update teacher error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete teacher
 * @route   DELETE /api/teacher/delete/:id
 * @access  Admin only
 */
export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
