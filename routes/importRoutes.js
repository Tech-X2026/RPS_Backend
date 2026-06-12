import express from 'express';
import multer from 'multer';
import {
  previewImport,
  confirmImport,
  downloadTemplate,
} from '../controllers/importController.js';
import protect from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/csv',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  },
});

router.post('/preview', upload.single('file'), previewImport);
router.post('/confirm', confirmImport);
router.get('/template', downloadTemplate);

export default router;
