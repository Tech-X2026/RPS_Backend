import SiblingGroup from '../models/SiblingGroup.js';
import Student from '../models/Student.js';

/**
 * @desc    Create a sibling group
 * @route   POST /api/siblings/create
 */
export const createSiblingGroup = async (req, res) => {
  try {
    const { parentName, parentPhone, parentEmail, studentIds, transportDiscount } = req.body;

    if (!parentName) {
      return res.status(400).json({ message: 'Parent name is required' });
    }

    const group = new SiblingGroup({
      parentName,
      parentPhone: parentPhone || '',
      parentEmail: parentEmail || '',
      students: studentIds || [],
      transportDiscount: transportDiscount || { secondChild: 50, thirdChildOnwards: 100 },
    });

    await group.save();

    // Link students to this group
    if (studentIds && studentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentIds } },
        { $set: { siblingGroupId: group._id } }
      );
    }

    const populated = await SiblingGroup.findById(group._id).populate(
      'students',
      'uid studentName className section feesStructure'
    );

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create sibling group error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all sibling groups
 * @route   GET /api/siblings/all
 */
export const getAllSiblingGroups = async (req, res) => {
  try {
    const groups = await SiblingGroup.find({})
      .populate('students', 'uid studentName className section feesStructure feesPaid feesLeft')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    console.error('Get sibling groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get single sibling group
 * @route   GET /api/siblings/:id
 */
export const getSiblingGroup = async (req, res) => {
  try {
    const group = await SiblingGroup.findById(req.params.id).populate(
      'students',
      'uid studentName className section feesStructure feesPaid feesLeft transportRoute transportStop'
    );

    if (!group) return res.status(404).json({ message: 'Sibling group not found' });

    res.json(group);
  } catch (error) {
    console.error('Get sibling group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Link a student to a sibling group
 * @route   POST /api/siblings/:id/link
 */
export const linkSibling = async (req, res) => {
  try {
    const { studentId } = req.body;
    const group = await SiblingGroup.findById(req.params.id);

    if (!group) return res.status(404).json({ message: 'Sibling group not found' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Check if already linked
    if (group.students.includes(studentId)) {
      return res.status(400).json({ message: 'Student already in this sibling group' });
    }

    // Remove from any existing group
    if (student.siblingGroupId) {
      await SiblingGroup.findByIdAndUpdate(student.siblingGroupId, {
        $pull: { students: studentId },
      });
    }

    group.students.push(studentId);
    await group.save();

    student.siblingGroupId = group._id;
    await student.save();

    const populated = await SiblingGroup.findById(group._id).populate(
      'students',
      'uid studentName className section feesStructure'
    );

    res.json(populated);
  } catch (error) {
    console.error('Link sibling error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Unlink a student from a sibling group
 * @route   POST /api/siblings/:id/unlink
 */
export const unlinkSibling = async (req, res) => {
  try {
    const { studentId } = req.body;
    const group = await SiblingGroup.findById(req.params.id);

    if (!group) return res.status(404).json({ message: 'Sibling group not found' });

    group.students = group.students.filter((id) => id.toString() !== studentId);
    await group.save();

    await Student.findByIdAndUpdate(studentId, { $set: { siblingGroupId: null } });

    const populated = await SiblingGroup.findById(group._id).populate(
      'students',
      'uid studentName className section feesStructure'
    );

    res.json(populated);
  } catch (error) {
    console.error('Unlink sibling error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update sibling group (parent info + discount)
 * @route   PUT /api/siblings/update/:id
 */
export const updateSiblingGroup = async (req, res) => {
  try {
    const group = await SiblingGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Sibling group not found' });

    const { parentName, parentPhone, parentEmail, transportDiscount } = req.body;

    if (parentName !== undefined) group.parentName = parentName;
    if (parentPhone !== undefined) group.parentPhone = parentPhone;
    if (parentEmail !== undefined) group.parentEmail = parentEmail;
    if (transportDiscount) {
      if (transportDiscount.secondChild !== undefined) {
        group.transportDiscount.secondChild = transportDiscount.secondChild;
      }
      if (transportDiscount.thirdChildOnwards !== undefined) {
        group.transportDiscount.thirdChildOnwards = transportDiscount.thirdChildOnwards;
      }
    }

    await group.save();

    const populated = await SiblingGroup.findById(group._id).populate(
      'students',
      'uid studentName className section feesStructure'
    );

    res.json(populated);
  } catch (error) {
    console.error('Update sibling group error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete sibling group
 * @route   DELETE /api/siblings/delete/:id
 */
export const deleteSiblingGroup = async (req, res) => {
  try {
    const group = await SiblingGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Sibling group not found' });

    // Unlink all students
    await Student.updateMany(
      { siblingGroupId: group._id },
      { $set: { siblingGroupId: null } }
    );

    await SiblingGroup.findByIdAndDelete(req.params.id);

    res.json({ message: 'Sibling group deleted successfully' });
  } catch (error) {
    console.error('Delete sibling group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
