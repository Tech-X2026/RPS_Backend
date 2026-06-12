import express from 'express';
import {
  createFeesStructure,
  getAllFeesStructures,
  updateFeesStructure,
  deleteFeesStructure,
} from '../controllers/feesController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/create-structure', createFeesStructure);
router.get('/all', getAllFeesStructures);
router.put('/update/:id', updateFeesStructure);
router.delete('/delete/:id', deleteFeesStructure);

export default router;
