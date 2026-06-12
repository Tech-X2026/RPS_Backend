/**
 * Role-based access control middleware
 * Must be used AFTER the protect middleware
 */

/**
 * Restrict to admin role only
 */
export const adminOnly = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

/**
 * Allow both staff and admin roles
 */
export const staffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  const allowed = ['admin', 'superadmin', 'staff'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  next();
};

/**
 * Allow staff to read (GET) but only admin can modify (POST/PUT/DELETE)
 */
export const adminOnlyForUpdates = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const readMethods = ['GET', 'HEAD', 'OPTIONS'];
  const isReadOnly = readMethods.includes(req.method.toUpperCase());

  if (isReadOnly) {
    // Both staff and admin can read
    return next();
  }

  // Only admin can modify
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      message: 'Access denied. Only admin can modify attendance records.',
    });
  }

  next();
};
