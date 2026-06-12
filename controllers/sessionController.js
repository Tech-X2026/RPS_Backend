import SessionSettings from '../models/SessionSettings.js';

/**
 * @desc    Get the active session settings
 * @route   GET /api/session
 * @access  Private
 */
export const getActiveSession = async (req, res) => {
  try {
    let session = await SessionSettings.findOne({ isActive: true });

    // If no session exists, create a default one (current academic year, April-March)
    if (!session) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startYear = month >= 3 ? year : year - 1;
      const endYear = startYear + 1;

      session = await SessionSettings.create({
        sessionYear: `${startYear}-${endYear}`,
        startMonth: 3, // April
        endMonth: 2,    // March
        isActive: true,
      });
    }

    const totalMonths = session.getTotalMonths();

    res.json({
      ...session.toObject(),
      totalMonths,
      sessionMonths: session.getSessionMonths(),
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Create or update session settings
 * @route   POST /api/session
 * @access  Private (Admin)
 */
export const createOrUpdateSession = async (req, res) => {
  try {
    const { sessionYear, startMonth, endMonth } = req.body;

    if (!sessionYear || startMonth === undefined || endMonth === undefined) {
      return res.status(400).json({
        message: 'Session year, start month, and end month are required',
      });
    }

    if (startMonth < 0 || startMonth > 11 || endMonth < 0 || endMonth > 11) {
      return res.status(400).json({
        message: 'Month values must be between 0 (January) and 11 (December)',
      });
    }

    // Deactivate all existing sessions
    await SessionSettings.updateMany({}, { isActive: false });

    // Check if a session with this year already exists
    let session = await SessionSettings.findOne({ sessionYear });

    if (session) {
      session.startMonth = startMonth;
      session.endMonth = endMonth;
      session.isActive = true;
      await session.save();
    } else {
      session = await SessionSettings.create({
        sessionYear,
        startMonth,
        endMonth,
        isActive: true,
      });
    }

    const totalMonths = session.getTotalMonths();

    res.json({
      ...session.toObject(),
      totalMonths,
      sessionMonths: session.getSessionMonths(),
      message: 'Session settings updated successfully',
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
