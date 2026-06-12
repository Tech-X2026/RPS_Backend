import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Teacher from '../models/Teacher.js';

/**
 * Generate JWT Token with role info
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

/**
 * @desc    Unified Login (Admin + Staff)
 * @route   POST /api/admin/login
 * @access  Public
 */
export const loginAdmin = async (req, res) => {
  try {
    const { email, password, loginAs } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // If loginAs is 'staff', check Teacher collection first
    if (loginAs === 'staff') {
      const teacher = await Teacher.findOne({ email: email.toLowerCase() });
      if (!teacher) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      if (teacher.status !== 'active') {
        return res.status(401).json({ message: 'Your account is inactive. Contact admin.' });
      }
      const isMatch = await teacher.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      return res.json({
        _id: teacher._id,
        email: teacher.email,
        name: teacher.name,
        role: 'staff',
        assignedClasses: teacher.assignedClasses,
        token: generateToken(teacher._id, 'staff'),
      });
    }

    // Default: Admin login using .env credentials
    if (email.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const adminId = 'admin_env_id';

    res.json({
      _id: adminId,
      email: process.env.ADMIN_EMAIL,
      role: 'superadmin',
      token: generateToken(adminId, 'superadmin'),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Seed first admin account
 * @route   POST /api/admin/seed
 * @access  Protected by ADMIN_SEED_SECRET
 */
export const seedAdmin = async (req, res) => {
  res.status(404).json({ message: 'Seed functionality removed. Use .env credentials instead.' });
};

/**
 * @desc    Get user profile (admin or staff)
 * @route   GET /api/admin/profile
 * @access  Private
 */
export const getProfile = async (req, res) => {
  try {
    if (req.user.role === 'staff') {
      return res.json({
        _id: req.teacher._id,
        email: req.teacher.email,
        name: req.teacher.name,
        role: 'staff',
        assignedClasses: req.teacher.assignedClasses,
      });
    }
    res.json({
      _id: 'admin_env_id',
      email: process.env.ADMIN_EMAIL,
      role: 'superadmin',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
