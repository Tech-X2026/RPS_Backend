import express from 'express';
import {
  createRoute,
  getAllRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
  assignStudent,
} from '../controllers/transportController.js';
import protect from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/create', createRoute);
router.get('/all', getAllRoutes);
router.get('/:id', getRouteById);
router.put('/update/:id', updateRoute);
router.delete('/delete/:id', deleteRoute);
router.post('/assign-student', assignStudent);

export default router;
