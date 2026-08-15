const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { broadcastDeadlineNotifications, previewDeadlineNotifications } = require('../controllers/notificationController');

const router = express.Router();

router.post('/broadcast/deadlines', authMiddleware, allowRoles('admin'), broadcastDeadlineNotifications);
router.get('/broadcast/deadlines/preview', authMiddleware, allowRoles('admin'), previewDeadlineNotifications);

module.exports = router;