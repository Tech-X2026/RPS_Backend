import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Teacher from '../models/Teacher.js';

/**
 * Unified auth middleware - checks both Admin and Teacher collections
 * Sets req.user with { id, role, email, model }
 * Also sets req.admin for backward compatibility when user is admin
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role === 'staff') {
        // Teacher/Staff login
        const teacher = await Teacher.findById(decoded.id).select('-password');
        if (!teacher) {
          return res.status(401).json({ message: 'User not found' });
        }
        if (teacher.status !== 'active') {
          return res.status(401).json({ message: 'Account is inactive' });
        }
        req.user = {
          id: teacher._id,
          role: 'staff',
          email: teacher.email,
          name: teacher.name,
          model: 'Teacher',
        };
        req.teacher = teacher;
      } else {
        // Admin login
        if (decoded.id !== 'admin_env_id' && decoded.role !== 'superadmin' && decoded.role !== 'admin') {
           return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = {
          id: 'admin_env_id',
          role: 'superadmin',
          email: process.env.ADMIN_EMAIL,
          model: 'Admin',
        };
        req.admin = req.user; // Mock the admin object for backward compatibility
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

export default protect;
