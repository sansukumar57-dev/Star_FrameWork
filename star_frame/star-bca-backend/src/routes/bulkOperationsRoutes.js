const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  exportStudentsCSV,
  exportSubmissionsExcel,
  generateDepartmentReport,
  bulkImportStudentsCSV,
  bulkUpdateSubmissions,
  bulkAssignTeachersToStudents
} = require('../controllers/bulkOperationsController');

const router = express.Router();

router.use(authMiddleware);

// Exports
router.get('/export/students/csv', allowRoles('admin'), exportStudentsCSV);
router.get('/export/submissions/excel', allowRoles('faculty', 'admin'), exportSubmissionsExcel);
router.get('/export/department/report', allowRoles('admin'), generateDepartmentReport);

// Bulk imports
router.post('/import/students', allowRoles('faculty', 'admin'), bulkImportStudentsCSV);

// Bulk operations
router.post('/update/submissions', allowRoles('faculty', 'admin'), bulkUpdateSubmissions);
router.post('/assign/teachers', allowRoles('admin'), bulkAssignTeachersToStudents);

module.exports = router;
