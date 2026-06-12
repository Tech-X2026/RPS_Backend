import FeesStructure from '../models/FeesStructure.js';

/**
 * @desc    Create fee structure for a class-section
 * @route   POST /api/fees/create-structure
 * @access  Private
 */
export const createFeesStructure = async (req, res) => {
  try {
    const { className, section, tuitionFees, transportFees, registrationFee, admissionFee, developmentFee, schoolKitFee } = req.body;

    if (!className || !section || tuitionFees === undefined) {
      return res.status(400).json({
        message: 'Class name, section, and tuition fees are required',
      });
    }

    // Check if structure already exists for this class-section
    const existing = await FeesStructure.findOne({
      className,
      section: section.toUpperCase(),
    });

    if (existing) {
      return res.status(400).json({
        message: `Fee structure already exists for Class ${className}-${section}. Use update instead.`,
      });
    }

    const feeStructure = await FeesStructure.create({
      className,
      section: section.toUpperCase(),
      tuitionFees: Number(tuitionFees),
      transportFees: Number(transportFees) || 0,
      registrationFee: Number(registrationFee) || 0,
      admissionFee: Number(admissionFee) || 0,
      developmentFee: Number(developmentFee) || 0,
      schoolKitFee: Number(schoolKitFee) || 0,
    });

    res.status(201).json(feeStructure);
  } catch (error) {
    console.error('Create fee structure error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Fee structure already exists for this class-section combination',
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all fee structures
 * @route   GET /api/fees/all
 * @access  Private
 */
export const getAllFeesStructures = async (req, res) => {
  try {
    const structures = await FeesStructure.find({}).sort({
      className: 1,
      section: 1,
    });

    res.json(structures);
  } catch (error) {
    console.error('Get fee structures error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update fee structure
 * @route   PUT /api/fees/update/:id
 * @access  Private
 */
export const updateFeesStructure = async (req, res) => {
  try {
    const { tuitionFees, transportFees, registrationFee, admissionFee, developmentFee, schoolKitFee } = req.body;

    const feeStructure = await FeesStructure.findById(req.params.id);

    if (!feeStructure) {
      return res.status(404).json({ message: 'Fee structure not found' });
    }

    if (tuitionFees !== undefined) feeStructure.tuitionFees = Number(tuitionFees);
    if (transportFees !== undefined) feeStructure.transportFees = Number(transportFees);
    if (registrationFee !== undefined) feeStructure.registrationFee = Number(registrationFee);
    if (admissionFee !== undefined) feeStructure.admissionFee = Number(admissionFee);
    if (developmentFee !== undefined) feeStructure.developmentFee = Number(developmentFee);
    if (schoolKitFee !== undefined) feeStructure.schoolKitFee = Number(schoolKitFee);

    await feeStructure.save();

    res.json(feeStructure);
  } catch (error) {
    console.error('Update fee structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Delete fee structure
 * @route   DELETE /api/fees/delete/:id
 * @access  Private
 */
export const deleteFeesStructure = async (req, res) => {
  try {
    const feeStructure = await FeesStructure.findById(req.params.id);

    if (!feeStructure) {
      return res.status(404).json({ message: 'Fee structure not found' });
    }

    await FeesStructure.findByIdAndDelete(req.params.id);

    res.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
