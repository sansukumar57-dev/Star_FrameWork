const express = require('express');
const { loginStudent, loginTeacher, loginAdmin, registerTeacher, registerStudent, authValidators } = require('../controllers/authController');

const router = express.Router();

router.post('/student/login', authValidators.loginStudent, loginStudent);
router.post('/teacher/login', authValidators.loginTeacher, loginTeacher);
router.post('/admin/login', authValidators.loginAdmin, loginAdmin);
router.post('/teacher/register', registerTeacher);
router.post('/student/register', registerStudent);

module.exports = router;
