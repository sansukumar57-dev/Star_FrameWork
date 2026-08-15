const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  suggestActivity,
  getAtRisk,
  notifyAtRisk,
  getTrends,
  getDuplicates,
  previewDigest,
  sendDigest,
} = require('../controllers/adminAiController');

const router = express.Router();

router.use(authMiddleware, allowRoles('admin'));

router.post('/activity-suggestions', suggestActivity);
router.get('/at-risk', getAtRisk);
router.post('/at-risk/notify', notifyAtRisk);
router.get('/trends', getTrends);
router.get('/duplicates', getDuplicates);
router.post('/digest/preview', previewDigest);
router.post('/digest/send', sendDigest);

module.exports = router;