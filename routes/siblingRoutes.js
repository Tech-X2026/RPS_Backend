import express from 'express';
import {
  createSiblingGroup,
  getAllSiblingGroups,
  getSiblingGroup,
  linkSibling,
  unlinkSibling,
  updateSiblingGroup,
  deleteSiblingGroup,
} from '../controllers/siblingController.js';
import protect from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/create', createSiblingGroup);
router.get('/all', getAllSiblingGroups);
router.get('/:id', getSiblingGroup);
router.post('/:id/link', linkSibling);
router.post('/:id/unlink', unlinkSibling);
router.put('/update/:id', updateSiblingGroup);
router.delete('/delete/:id', deleteSiblingGroup);

export default router;
