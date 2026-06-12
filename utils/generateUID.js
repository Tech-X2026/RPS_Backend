import Student from '../models/Student.js';

/**
 * Map class names to short codes for UIDs.
 * Pre-primary classes get short codes; numbered classes use the number directly.
 */
const CLASS_CODE_MAP = {
  playgroup: 'PG',
  nursery: 'NUR',
  lkg: 'LKG',
  ukg: 'UKG',
};

/**
 * Get the short code for a class name.
 * @param {string} className - e.g., "Playgroup", "Nursery", "LKG", "UKG", "1", "10"
 * @returns {string} Short code for the UID prefix
 */
export const getClassCode = (className) => {
  const lower = className.toLowerCase().trim();
  return CLASS_CODE_MAP[lower] || className.trim();
};

/**
 * Generate a unique UID for a student in the format: RPS-{CLASSCODE}{SECTION}-{SERIAL}
 * Examples:
 *   Class 10, Section A → RPS-10A-001
 *   Playgroup, Section A → RPS-PGA-001
 *   Nursery, Section B  → RPS-NURB-001
 *   LKG, Section A      → RPS-LKGA-001
 *
 * @param {string} className - The class name (e.g., "10", "Playgroup", "LKG")
 * @param {string} section - The section (e.g., "A", "B")
 * @returns {Promise<string>} The generated UID
 */
const generateUID = async (className, section) => {
  const classCode = getClassCode(className);
  const prefix = `RPS-${classCode}${section.toUpperCase()}-`;

  // Find the latest student in this class-section by UID
  const latestStudent = await Student.findOne({
    uid: { $regex: `^${escapeRegExp(prefix)}` },
  })
    .sort({ uid: -1 })
    .select('uid');

  let serial = 1;

  if (latestStudent) {
    // Extract the serial number from the UID
    const parts = latestStudent.uid.split('-');
    const lastSerial = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSerial)) {
      serial = lastSerial + 1;
    }
  }

  // Pad serial to 3 digits
  const serialStr = serial.toString().padStart(3, '0');
  return `${prefix}${serialStr}`;
};

/**
 * Generate UIDs for a batch of students, sorted alphabetically by name.
 * Used during bulk import.
 *
 * @param {Array<{studentName: string, className: string, section: string}>} students
 * @returns {Promise<Array<string>>} Array of generated UIDs in the same order as input
 */
export const generateBatchUIDs = async (students) => {
  // Group by class-section
  const groups = {};
  students.forEach((s, index) => {
    const key = `${s.className}|${s.section.toUpperCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...s, originalIndex: index });
  });

  const uids = new Array(students.length);

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    const [className, section] = key.split('|');
    const classCode = getClassCode(className);
    const prefix = `RPS-${classCode}${section}-`;

    // Sort alphabetically by student name within the group
    group.sort((a, b) => a.studentName.localeCompare(b.studentName, 'en', { sensitivity: 'base' }));

    // Find highest existing serial for this prefix
    const latestStudent = await Student.findOne({
      uid: { $regex: `^${escapeRegExp(prefix)}` },
    })
      .sort({ uid: -1 })
      .select('uid');

    let serial = 1;
    if (latestStudent) {
      const parts = latestStudent.uid.split('-');
      const lastSerial = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSerial)) serial = lastSerial + 1;
    }

    // Assign UIDs in alphabetical order
    for (const student of group) {
      const serialStr = serial.toString().padStart(3, '0');
      uids[student.originalIndex] = `${prefix}${serialStr}`;
      serial++;
    }
  }

  return uids;
};

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default generateUID;
