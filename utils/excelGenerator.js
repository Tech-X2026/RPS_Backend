import ExcelJS from 'exceljs';

/**
 * Create a styled Excel workbook with data.
 *
 * @param {Object} options
 * @param {string} options.title - Report title
 * @param {string} options.subtitle - Optional subtitle (e.g., date range, filters)
 * @param {Array<{header: string, key: string, width: number, style?: object}>} options.columns
 * @param {Array<object>} options.rows - Data rows
 * @param {string} [options.sheetName='Report'] - Sheet name
 * @returns {Promise<Buffer>} Excel file buffer
 */
export const generateExcelReport = async ({
  title,
  subtitle = '',
  columns,
  rows,
  sheetName = 'Report',
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rudrapur Public School ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  // ── Title Row ──
  const titleRow = sheet.addRow([title]);
  titleRow.font = { size: 16, bold: true, color: { argb: 'FF1A1A2E' } };
  sheet.mergeCells(1, 1, 1, columns.length);
  titleRow.alignment = { horizontal: 'center' };
  titleRow.height = 30;

  // ── Subtitle Row ──
  if (subtitle) {
    const subRow = sheet.addRow([subtitle]);
    subRow.font = { size: 11, italic: true, color: { argb: 'FF666666' } };
    sheet.mergeCells(2, 1, 2, columns.length);
    subRow.alignment = { horizontal: 'center' };
  }

  // ── Empty Row ──
  sheet.addRow([]);

  // ── Header Row ──
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Re-add headers at correct row (after title rows)
  const headerRowNum = subtitle ? 4 : 3;
  const headerRow = sheet.getRow(headerRowNum);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = 24;

  // ── Data Rows ──
  rows.forEach((rowData, idx) => {
    const dataRow = sheet.addRow(
      columns.map((col) => rowData[col.key] ?? '')
    );
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
      cell.alignment = { vertical: 'middle' };
    });
    // Alternating row colors
    if (idx % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      });
    }
  });

  // ── Summary Row ──
  const totalRow = sheet.addRow([]);
  totalRow.font = { bold: true };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * Generate a blank student import template.
 * @returns {Promise<Buffer>}
 */
export const generateImportTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rudrapur Public School ERP';

  const sheet = workbook.addWorksheet('Student Import');

  // Title
  const titleRow = sheet.addRow(['Rudrapur Public School — Student Import Template']);
  titleRow.font = { size: 14, bold: true };
  sheet.mergeCells(1, 1, 1, 12);
  titleRow.alignment = { horizontal: 'center' };

  // Instructions
  const instrRow = sheet.addRow([
    'Fill in student details below. UID will be auto-generated. Class values: Playgroup, Nursery, LKG, UKG, 1-12. Section values: A, B, C, D, E.',
  ]);
  instrRow.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
  sheet.mergeCells(2, 1, 2, 12);

  sheet.addRow([]);

  // Headers
  const headers = [
    'Student Name',
    'Class',
    'Section',
    'Father Email',
    'Father WhatsApp',
    'Address',
    'Custom Tuition Fees',
    'Custom Transport Fees',
    'Custom Registration Fee',
    'Custom Admission Fee',
    'Custom Development Fee',
    'Custom School Kit Fee',
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Set column widths
  sheet.getColumn(1).width = 25;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 25;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 20;
  sheet.getColumn(8).width = 22;
  sheet.getColumn(9).width = 24;
  sheet.getColumn(10).width = 22;
  sheet.getColumn(11).width = 24;
  sheet.getColumn(12).width = 23;

  // Sample rows
  const samples = [
    ['Amit Kumar', '1', 'A', 'amit@email.com', '9876543210', '123 Main St', '', '', '', '', '', ''],
    ['Priya Sharma', 'LKG', 'B', '', '9123456789', '', '', '', '', '', '', ''],
    ['Rahul Singh', 'Playgroup', 'A', 'rahul@email.com', '', 'Block C, Sector 5', '5000', '2000', '1000', '5000', '2000', '1500'],
  ];

  samples.forEach((row) => {
    const dataRow = sheet.addRow(row);
    dataRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF999999' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });
  });

  // Add note
  sheet.addRow([]);
  const noteRow = sheet.addRow([
    '⚠️ Delete these sample rows before importing. Fields marked (*) in headers are required. Custom fees are optional and will fallback to class structure if left blank.',
  ]);
  noteRow.font = { bold: true, color: { argb: 'FFCC0000' } };
  sheet.mergeCells(noteRow.number, 1, noteRow.number, 12);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export default { generateExcelReport, generateImportTemplate };
