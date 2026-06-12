import express from 'express';
import {
  generateDemandBill,
  generateClassDemandBill,
  getLastYearDuesReport,
  getCollectionReport,
  generateReport,
  getReportTypes,
} from '../controllers/reportController.js';
import protect from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/types', getReportTypes);
router.get('/demand-bill/:studentId', generateDemandBill);
router.get('/demand-bill-class', generateClassDemandBill);
router.get('/last-year-dues', getLastYearDuesReport);
router.get('/collection', getCollectionReport);
router.get('/generate', generateReport);

export default router;
