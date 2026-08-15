const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { getAllSubmissions, getSubmissionFile } = require('../controllers/submissionController');

const router = express.Router();

router.use(authMiddleware, allowRoles('faculty', 'teacher'));
router.get('/', getAllSubmissions);
router.get('/:id/file', getSubmissionFile);

module.exports = router;
