const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const deanScopedMiddleware = require('../middleware/deanScopedMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getUsers, exportUsers, getUserById, createDepartment, createUser, updateUser, deleteUser, resetPassword, getAnalytics, getLookups, createBulkUsers, listActivities, createActivity, updateActivity, deleteActivity, exportAnalytics, downloadBulkTemplate, getAuditLogs, getAcademicSettings, updateAcademicSettings, rolloverAcademicYear } = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, allowRoles('admin'));
router.use(deanScopedMiddleware);

router.get('/analytics', getAnalytics);
router.get('/analytics/export', exportAnalytics);
router.get('/lookups', getLookups);
router.get('/bulk-upload/template', downloadBulkTemplate);
router.get('/audit-logs', getAuditLogs);
router.get('/academic-year', getAcademicSettings);
router.put('/academic-year', updateAcademicSettings);
router.post('/academic-year/rollover', rolloverAcademicYear);
router.get('/activities', listActivities);
router.post('/activities', createActivity);
router.put('/activities/:id', updateActivity);
router.delete('/activities/:id', deleteActivity);
router.get('/users', getUsers);
router.get('/users/export', exportUsers);
router.get('/users/:id', getUserById);
router.post('/departments', createDepartment);
router.post('/users', createUser);
router.post('/users/bulk-upload', upload.single('file'), createBulkUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/reset-password', resetPassword);

module.exports = router;
