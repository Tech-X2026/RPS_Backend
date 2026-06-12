import XLSX from 'xlsx';
import Student from '../models/Student.js';
import FeesStructure from '../models/FeesStructure.js';
import { generateBatchUIDs, getClassCode } from '../utils/generateUID.js';
import { generateImportTemplate } from '../utils/excelGenerator.js';

// Valid class names
const VALID_CLASSES = [
  'Playgroup', 'Nursery', 'LKG', 'UKG',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

const VALID_SECTIONS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Normalize class name from various formats to standard format.
 */
const normalizeClassName = (raw) => {
  if (!raw) return null;
  const str = String(raw).trim();
  const lower = str.toLowerCase();

  // Pre-primary
  if (['playgroup', 'play group', 'pg', 'play-group'].includes(lower)) return 'Playgroup';
  if (['nursery', 'nur', 'nrs'].includes(lower)) return 'Nursery';
  if (['lkg', 'l.k.g', 'l.k.g.', 'lower kg', 'jr kg'].includes(lower)) return 'LKG';
  if (['ukg', 'u.k.g', 'u.k.g.', 'upper kg', 'sr kg'].includes(lower)) return 'UKG';

  // Numbered classes
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return String(num);

  // "Class 5" format
  const classMatch = lower.match(/class\s*(\d+)/);
  if (classMatch) {
    const cn = parseInt(classMatch[1], 10);
    if (cn >= 1 && cn <= 12) return String(cn);
  }

  return null; // Invalid
};

/**
 * @desc    Preview import — parse file, validate, return preview data
 * @route   POST /api/import/preview
 */
export const previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return res.status(400).json({ message: 'File is empty or has no data rows' });
    }

    // Map column headers (case-insensitive, flexible naming)
    const mapHeader = (row) => {
      const mapped = {};
      const keys = Object.keys(row);
      for (const key of keys) {
        const lower = key.toLowerCase().trim();
        if (lower.includes('student') && lower.includes('name')) mapped.studentName = row[key];
        else if (lower === 'class' || lower === 'classname' || lower === 'class name') mapped.className = row[key];
        else if (lower === 'section') mapped.section = row[key];
        else if (lower.includes('father') && lower.includes('email')) mapped.fatherEmail = row[key];
        else if (lower.includes('father') && lower.includes('whatsapp')) mapped.fatherWhatsapp = row[key];
        else if (lower.includes('whatsapp') || lower.includes('phone') || lower.includes('mobile')) mapped.fatherWhatsapp = mapped.fatherWhatsapp || row[key];
        else if (lower === 'address') mapped.address = row[key];
        else if (lower.includes('custom') && lower.includes('tuition')) mapped.customTuition = row[key];
        else if (lower.includes('custom') && lower.includes('transport')) mapped.customTransport = row[key];
        else if (lower.includes('custom') && lower.includes('registration')) mapped.customRegistration = row[key];
        else if (lower.includes('custom') && lower.includes('admission')) mapped.customAdmission = row[key];
        else if (lower.includes('custom') && lower.includes('development')) mapped.customDevelopment = row[key];
        else if (lower.includes('custom') && lower.includes('school') && lower.includes('kit')) mapped.customSchoolKit = row[key];
        else if (lower === 'email') mapped.fatherEmail = mapped.fatherEmail || row[key];
      }
      return mapped;
    };

    // Fetch all fee structures for lookup
    const feeStructures = await FeesStructure.find({});
    const feeMap = {};
    feeStructures.forEach((f) => {
      feeMap[`${f.className}|${f.section}`] = f;
    });

    const students = [];
    const errors = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // 1-indexed, +1 for header
      const mapped = mapHeader(rawRows[i]);

      const rowErrors = [];

      // Validate student name
      const studentName = String(mapped.studentName || '').trim();
      if (!studentName) rowErrors.push('Student Name is required');

      // Validate & normalize class
      const className = normalizeClassName(mapped.className);
      if (!className) rowErrors.push(`Invalid class: "${mapped.className}". Valid: ${VALID_CLASSES.join(', ')}`);

      // Validate section
      const section = String(mapped.section || '').trim().toUpperCase();
      if (!section || !VALID_SECTIONS.includes(section)) {
        rowErrors.push(`Invalid section: "${mapped.section}". Valid: ${VALID_SECTIONS.join(', ')}`);
      }

      // Optional fields
      const fatherEmail = String(mapped.fatherEmail || '').trim().toLowerCase();
      const fatherWhatsapp = String(mapped.fatherWhatsapp || '').trim();
      const address = String(mapped.address || '').trim();

      // Validate email format if provided
      if (fatherEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fatherEmail)) {
        rowErrors.push(`Invalid email format: "${fatherEmail}"`);
      }

      // Validate phone if provided
      if (fatherWhatsapp && !/^\d{10,}$/.test(fatherWhatsapp.replace(/[+\-\s]/g, ''))) {
        rowErrors.push(`Invalid phone number: "${fatherWhatsapp}"`);
      }

      // Custom fees
      const customTuition = mapped.customTuition ? Number(mapped.customTuition) : null;
      const customTransport = mapped.customTransport ? Number(mapped.customTransport) : null;
      const customRegistration = mapped.customRegistration ? Number(mapped.customRegistration) : null;
      const customAdmission = mapped.customAdmission ? Number(mapped.customAdmission) : null;
      const customDevelopment = mapped.customDevelopment ? Number(mapped.customDevelopment) : null;
      const customSchoolKit = mapped.customSchoolKit ? Number(mapped.customSchoolKit) : null;
      
      const hasCustomFees = customTuition !== null || customTransport !== null || customRegistration !== null || customAdmission !== null || customDevelopment !== null || customSchoolKit !== null;

      // Fee lookup
      let tuitionFees = 0;
      let transportFees = 0;
      let registrationFee = 0;
      let admissionFee = 0;
      let developmentFee = 0;
      let schoolKitFee = 0;
      let feeStructureFound = false;

      if (className && section) {
        const fee = feeMap[`${className}|${section}`];
        if (fee) {
          tuitionFees = fee.tuitionFees || 0;
          transportFees = fee.transportFees || 0;
          registrationFee = fee.registrationFee || 0;
          admissionFee = fee.admissionFee || 0;
          developmentFee = fee.developmentFee || 0;
          schoolKitFee = fee.schoolKitFee || 0;
          feeStructureFound = true;
        }
      }

      if (hasCustomFees) {
        if (customTuition !== null) tuitionFees = customTuition;
        if (customTransport !== null) transportFees = customTransport;
        if (customRegistration !== null) registrationFee = customRegistration;
        if (customAdmission !== null) admissionFee = customAdmission;
        if (customDevelopment !== null) developmentFee = customDevelopment;
        if (customSchoolKit !== null) schoolKitFee = customSchoolKit;
      }

      const student = {
        rowNumber: rowNum,
        studentName,
        className: className || '',
        section,
        fatherEmail: fatherEmail || '',
        fatherWhatsapp: fatherWhatsapp || '',
        address: address || '',
        tuitionFees,
        transportFees,
        registrationFee,
        admissionFee,
        developmentFee,
        schoolKitFee,
        totalFees: tuitionFees + transportFees + registrationFee + admissionFee + developmentFee + schoolKitFee,
        hasCustomFees,
        customTuition,
        customTransport,
        customRegistration,
        customAdmission,
        customDevelopment,
        customSchoolKit,
        feeStructureFound,
        errors: rowErrors,
        isValid: rowErrors.length === 0,
      };

      students.push(student);
      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, errors: rowErrors });
      }
    }

    // Generate preview UIDs for valid students
    const validStudents = students.filter((s) => s.isValid);
    if (validStudents.length > 0) {
      const uids = await generateBatchUIDs(validStudents);
      validStudents.forEach((s, i) => {
        s.previewUID = uids[i];
      });
    }

    res.json({
      totalRows: students.length,
      validRows: validStudents.length,
      invalidRows: errors.length,
      students,
      errors,
    });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Confirm import — insert all valid students
 * @route   POST /api/import/confirm
 */
export const confirmImport = async (req, res) => {
  try {
    const { students } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No students data provided' });
    }

    // Re-validate all students
    const validStudents = students.filter((s) => s.studentName && s.className && s.section);

    if (validStudents.length === 0) {
      return res.status(400).json({ message: 'No valid students to import' });
    }

    // Generate fresh UIDs (in case data changed between preview and confirm)
    const uids = await generateBatchUIDs(validStudents);

    const created = [];
    const failed = [];

    for (let i = 0; i < validStudents.length; i++) {
      const s = validStudents[i];
      try {
        const studentData = {
          uid: uids[i],
          studentName: s.studentName,
          className: s.className,
          section: s.section.toUpperCase(),
          fatherEmail: s.fatherEmail || '',
          fatherWhatsapp: s.fatherWhatsapp || '',
          address: s.address || '',
          feesStructure: {
            tuitionFees: s.tuitionFees || 0,
            transportFees: s.transportFees || 0,
            registrationFee: s.registrationFee || 0,
            admissionFee: s.admissionFee || 0,
            developmentFee: s.developmentFee || 0,
            schoolKitFee: s.schoolKitFee || 0,
            totalFees: (s.tuitionFees || 0) + (s.transportFees || 0) + (s.registrationFee || 0) + (s.admissionFee || 0) + (s.developmentFee || 0) + (s.schoolKitFee || 0),
          },
          feesPaid: { tuitionPaid: 0, transportPaid: 0, registrationPaid: 0, admissionPaid: 0, developmentPaid: 0, schoolKitPaid: 0, totalPaid: 0 },
          feesLeft: {
            tuitionLeft: s.tuitionFees || 0,
            transportLeft: s.transportFees || 0,
            registrationLeft: s.registrationFee || 0,
            admissionLeft: s.admissionFee || 0,
            developmentLeft: s.developmentFee || 0,
            schoolKitLeft: s.schoolKitFee || 0,
            totalLeft: (s.tuitionFees || 0) + (s.transportFees || 0) + (s.registrationFee || 0) + (s.admissionFee || 0) + (s.developmentFee || 0) + (s.schoolKitFee || 0),
          },
        };

        // Apply custom fees if set
        if (s.hasCustomFees) {
          studentData.customFees = {
            isCustom: true,
            tuitionFees: s.customTuition !== null ? s.customTuition : s.tuitionFees,
            transportFees: s.customTransport !== null ? s.customTransport : s.transportFees,
            registrationFee: s.customRegistration !== null ? s.customRegistration : s.registrationFee,
            admissionFee: s.customAdmission !== null ? s.customAdmission : s.admissionFee,
            developmentFee: s.customDevelopment !== null ? s.customDevelopment : s.developmentFee,
            schoolKitFee: s.customSchoolKit !== null ? s.customSchoolKit : s.schoolKitFee,
            concessionType: 'none',
            concessionValue: 0,
            reason: 'Set during import',
          };
        }

        const student = await Student.create(studentData);
        created.push({
          uid: student.uid,
          studentName: student.studentName,
          className: student.className,
          section: student.section,
        });
      } catch (err) {
        failed.push({
          studentName: s.studentName,
          className: s.className,
          section: s.section,
          error: err.message,
        });
      }
    }

    res.json({
      message: `Import completed: ${created.length} added, ${failed.length} failed`,
      totalImported: created.length,
      totalFailed: failed.length,
      created,
      failed,
    });
  } catch (error) {
    console.error('Import confirm error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Download blank import template
 * @route   GET /api/import/template
 */
export const downloadTemplate = async (req, res) => {
  try {
    const buffer = await generateImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Student_Import_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
