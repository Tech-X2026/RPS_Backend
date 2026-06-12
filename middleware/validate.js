/**
 * Validate required fields in request body
 * @param {string[]} fields - Array of required field names
 */
export const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }
    next();
  };
};

/**
 * Validate email format
 */
export const validateEmail = (field = 'email') => {
  return (req, res, next) => {
    const email = req.body[field];
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: `Invalid email format for ${field}` });
    }
    next();
  };
};

/**
 * Validate that a number field is positive
 */
export const validatePositiveNumber = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      if (value !== undefined && (isNaN(value) || Number(value) < 0)) {
        return res.status(400).json({
          message: `${field} must be a non-negative number`,
        });
      }
    }
    next();
  };
};
