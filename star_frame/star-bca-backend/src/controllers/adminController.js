const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const User = require('../models/User');
const School = require('../models/School');
const Department = require('../models/Department');
const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const AuditLog = require('../models/AuditLog');
const SystemSetting = require('../models/SystemSetting');
const { normalizeBulkRow, isEmptyRow, getRequiredValidationErrors, getValue } = require('../utils/bulkUploadUtils');
const { validateDepartmentPayload } = require('../utils/deanScope');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit } = require('../utils/audit');

const buildUserResponse = (user) => {
  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  return safeUser;
};

const buildScopeQuery = (req, baseQuery = {}) => {
  const query = { ...baseQuery };
  if (req?.user?.accountType === 'dean' && req.user.schoolId) query.schoolId = req.user.schoolId;
  if (req?.user?.accountType === 'hod' && req.user.departmentId) query.departmentId = req.user.departmentId;
  return query;
};

const validateRoleScope = (req, payload) => {
  if (req.user?.accountType === 'dean') {
    if (payload.role !== 'admin' || (payload.accountType || 'hod') !== 'hod') {
      return 'Dean accounts can only add HODs.';
    }
  }
  if (req.user?.accountType === 'hod') {
    if (payload.role === 'admin') {
      return 'HOD accounts can only add students or faculty.';
    }
  }
  return null;
};

const getUsers = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const role = req.query.role || '';
    const accountType = req.query.accountType || '';
    const query = buildScopeQuery(req, {});

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registerNo: { $regex: search, $options: 'i' } },
        { registerNumber: { $regex: search, $options: 'i' } },
        { regNo: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) query.role = role;
    if (accountType) query.accountType = accountType;

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Users fetched successfully', users);
  } catch (error) {
    next(error);
  }
};

const exportUsers = async (req, res, next) => {
  try {
    const role = req.query.role || '';
    const query = buildScopeQuery(req, {});
    if (role) query.role = role;

    const users = await User.find(query).sort({ createdAt: -1 });
    const rows = users.map((user) => ({
      Name: user.name || '',
      Email: user.email || '',
      Role: user.role || '',
      AccountType: user.accountType || '',
      'Register Number': user.registerNumber || user.registerNo || user.regNo || '',
      School: user.school || '',
      Department: user.department || '',
      Section: user.section || '',
      Status: user.status || 'Active',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Users', `users-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return sendError(res, 404, 'User not found');

    const canManageStudents = req.user?.role === 'admin' || req.user?.accountType === 'hod' || req.user?.accountType === 'dean';
    if (!canManageStudents) return sendError(res, 403, 'Access denied');

    if (req.user?.accountType === 'hod' && req.user.departmentId && user.departmentId?.toString() !== req.user.departmentId.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    if (req.user?.accountType === 'dean' && req.user.schoolId && user.schoolId?.toString() !== req.user.schoolId.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    return sendSuccess(res, 200, 'User fetched successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    if (req.user?.accountType !== 'dean') {
      return sendError(res, 403, 'Only dean accounts can create departments');
    }

    const validation = validateDepartmentPayload(req.body, req);
    if (!validation.ok) {
      return sendError(res, 400, validation.errors.join(', '));
    }

    const existingDepartment = await Department.findOne({
      schoolId: validation.normalized.schoolId,
      $or: [
        { name: new RegExp(`^${validation.normalized.name}$`, 'i') },
        { code: validation.normalized.code },
      ],
    });

    if (existingDepartment) {
      return sendError(res, 400, 'A department with that name or code already exists in the selected school');
    }

    const department = await Department.create({
      ...validation.normalized,
      schoolId: validation.normalized.schoolId,
      status: validation.normalized.status || 'Active',
    });

    await logAudit(req, {
      action: 'Department created',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code },
    });

    return sendSuccess(res, 201, 'Department created successfully', department);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    const role = payload.role || 'student';
    const accountType = payload.accountType || null;
    const roleScopeError = validateRoleScope(req, { ...payload, role, accountType });
    if (roleScopeError) return sendError(res, 400, roleScopeError);

    if (!payload.name || !payload.password) {
      return sendError(res, 400, 'Name and password are required');
    }

    if (role === 'student') {
      if (!payload.registerNo && !payload.registerNumber && !payload.regNo) {
        return sendError(res, 400, 'Register number is required for students');
      }
    }

    if (role === 'faculty') {
      if (!payload.email) return sendError(res, 400, 'Email is required for faculty');
    }

    if (role === 'admin') {
      if (!payload.email) return sendError(res, 400, 'Email is required for admin users');
      if (accountType === 'hod' && !payload.departmentId) return sendError(res, 400, 'Department is required for HOD users');
      if (accountType === 'dean' && !payload.schoolId) return sendError(res, 400, 'School is required for Dean users');
    }

    const existing = await User.findOne({
      $or: [
        ...(payload.email ? [{ email: payload.email.toLowerCase() }] : []),
        ...(payload.registerNo || payload.registerNumber || payload.regNo ? [{ registerNo: payload.registerNo || payload.registerNumber || payload.regNo }, { regNo: payload.registerNo || payload.registerNumber || payload.regNo }, { registerNumber: payload.registerNo || payload.registerNumber || payload.regNo }] : []),
      ],
    });
    if (existing) return sendError(res, 400, 'A user with that identifier already exists');

    const userPayload = {
      ...payload,
      name: payload.name,
      role,
      accountType: role === 'admin' ? accountType : null,
      email: payload.email ? payload.email.toLowerCase() : undefined,
      school: payload.school || req.user?.school || 'STAR',
      department: payload.department || req.user?.department || '',
      schoolId: payload.schoolId || req.user?.schoolId || null,
      departmentId: payload.departmentId || req.user?.departmentId || null,
      registerNo: payload.registerNo || payload.registerNumber || payload.regNo || undefined,
      registerNumber: payload.registerNumber || payload.registerNo || payload.regNo || undefined,
      regNo: payload.regNo || payload.registerNo || payload.registerNumber || undefined,
      assignedTeacher: payload.assignedTeacher || payload.assignedFacultyId || null,
      assignedFacultyId: payload.assignedFacultyId || payload.assignedTeacher || null,
      assignedYear: payload.assignedYear || '',
      year: payload.year || payload.batch || payload.semesterBatch || '',
      batch: payload.batch || payload.semesterBatch || '',
      section: payload.section || '',
      semesterBatch: payload.semesterBatch || payload.batch || '',
    };

    if (req.user?.accountType === 'dean' && req.user.schoolId) userPayload.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod' && req.user.departmentId) {
      userPayload.departmentId = req.user.departmentId;
      userPayload.schoolId = req.user.schoolId || userPayload.schoolId;
    }

    const user = await User.create(userPayload);
    await logAudit(req, {
      action: 'User created',
      entityType: 'User',
      entityId: user._id,
      details: { name: user.name, role: user.role, accountType: user.accountType || null },
    });
    return sendSuccess(res, 201, 'User created successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return sendError(res, 404, 'User not found');

    const updates = Object.entries(req.body || {}).reduce((accumulator, [key, value]) => {
      if (value !== undefined) accumulator[key] = value;
      return accumulator;
    }, {});
    delete updates.password;

    const requestedRole = (updates.role || existingUser.role || 'student').toLowerCase();
    const isStudentUpdate = requestedRole === 'student' || existingUser.role === 'student';

    if (isStudentUpdate) {
      const canManageStudents = req.user?.role === 'admin' || req.user?.accountType === 'hod' || req.user?.accountType === 'dean';
      if (!canManageStudents) return sendError(res, 403, 'Only Admin or HOD accounts can edit student details.');
      if (!updates.name || !String(updates.name).trim()) return sendError(res, 400, 'Name is required');
      if (!updates.email || !String(updates.email).trim()) return sendError(res, 400, 'Email is required');
      const registerValue = updates.registerNo || updates.registerNumber || updates.regNo || existingUser.registerNo || existingUser.registerNumber || existingUser.regNo;
      if (!registerValue) return sendError(res, 400, 'Register number is required');

      const duplicateUser = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(updates.email ? [{ email: String(updates.email).toLowerCase() }] : []),
          ...(registerValue ? [{ registerNo: String(registerValue).trim() }, { registerNumber: String(registerValue).trim() }, { regNo: String(registerValue).trim() }] : []),
        ],
      });

      if (duplicateUser) return sendError(res, 400, 'A user with that register number or email already exists');
    }

    const roleScopeError = isStudentUpdate
      ? null
      : validateRoleScope(req, { ...updates, role: requestedRole, accountType: updates.accountType || existingUser.accountType || null });
    if (roleScopeError) return sendError(res, 400, roleScopeError);

    if (updates.email) updates.email = String(updates.email).toLowerCase();
    if (updates.registerNo || updates.registerNumber || updates.regNo) {
      const registerValue = updates.registerNo || updates.registerNumber || updates.regNo;
      updates.registerNo = String(registerValue).trim();
      updates.registerNumber = String(registerValue).trim();
      updates.regNo = String(registerValue).trim();
    }

    if (updates.assignedTeacher || updates.assignedFacultyId) {
      const facultyId = updates.assignedTeacher || updates.assignedFacultyId;
      updates.assignedTeacher = facultyId;
      updates.assignedFacultyId = facultyId;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return sendError(res, 404, 'User not found');
    await logAudit(req, {
      action: 'User updated',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: user.name, role: user.role, updatedFields: Object.keys(updates) },
    });
    return sendSuccess(res, 200, 'User updated successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id });
    if (!user) return sendError(res, 404, 'User not found');
    await logAudit(req, {
      action: 'User deleted',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: user.name, role: user.role },
    });
    return sendSuccess(res, 200, 'User deleted successfully', { id: req.params.id });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const newPassword = req.body.newPassword || 'Welcome@123';
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');
    user.password = newPassword;
    await user.save();
    await logAudit(req, {
      action: 'Password reset',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: user.name },
    });
    return sendSuccess(res, 200, 'Password reset successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'dean') {
      const departments = await Department.find({ schoolId: req.user.schoolId, status: 'Active' }).select('_id name').sort({ name: 1 });
      const chartData = await Promise.all(departments.map(async (department) => {
        const students = await User.find({ role: 'student', departmentId: department._id }).select('_id name').lean();
        const studentIds = students.map((student) => student._id);
        const totalPoints = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
        ]);
        const pointResults = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
        ]);
        const pointMap = new Map(pointResults.map((entry) => [entry._id.toString(), entry.totalPoints || 0]));
        const topStudents = students
          .map((student) => ({
            _id: student._id,
            name: student.name,
            totalPoints: pointMap.get(student._id.toString()) || 0,
          }))
          .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
          .slice(0, 3);
        const averageScore = studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0;
        return {
          name: department.name,
          performance: averageScore,
          students: studentIds.length,
          departmentId: department._id,
          metric: 'Average approved points',
          topStudents,
        };
      }));
      return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'dean', chartData });
    }

    if (req.user?.accountType === 'hod') {
      const yearBuckets = [
        { key: '1st', label: '1st Year' },
        { key: '2nd', label: '2nd Year' },
        { key: '3rd', label: '3rd Year' },
      ];
      const chartData = await Promise.all(yearBuckets.map(async (bucket) => {
        const students = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id year').lean();
        const matching = students.filter((student) => {
          const yearValue = `${student.year || student.batch || student.semesterBatch || ''}`.toLowerCase();
          return yearValue.includes(bucket.key.toLowerCase()) || yearValue.includes(bucket.label.toLowerCase());
        });
        const studentIds = matching.map((student) => student._id);
        const totalPoints = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
        ]);
        return { name: bucket.label, performance: studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0, students: studentIds.length };
      }));
      return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'hod', chartData });
    }

    return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'admin', chartData: [] });
  } catch (error) {
    next(error);
  }
};

const getLookups = async (req, res, next) => {
  try {
    const schools = await School.find({ status: 'Active' }).select('_id name code').sort({ name: 1 }).lean();
    const departmentsQuery = { status: 'Active' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) departmentsQuery.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod') {
      if (req.user.schoolId) departmentsQuery.schoolId = req.user.schoolId;
      if (req.user.departmentId) departmentsQuery._id = req.user.departmentId;
    }
    const departments = await Department.find(departmentsQuery).populate('schoolId', 'name').sort({ name: 1 }).lean();
    const facultyQuery = { role: 'faculty', status: 'Active' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) facultyQuery.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod' && req.user.departmentId) facultyQuery.departmentId = req.user.departmentId;
    const faculty = await User.find(facultyQuery).select('_id name email departmentId schoolId department').sort({ name: 1 }).lean();
    return sendSuccess(res, 200, 'Lookups fetched successfully', { schools, departments, faculty });
  } catch (error) {
    next(error);
  }
};

const createBulkUsers = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'Please upload an Excel file');

    const fileName = (req.file.originalname || '').toLowerCase();
    const contentType = (req.file.mimetype || '').toLowerCase();
    const buffer = req.file.buffer;

    let rows = [];
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || contentType.includes('spreadsheetml') || contentType.includes('excel')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) || [];
    } else {
      return sendError(res, 400, 'Please upload a valid Excel file (.xlsx/.xls)');
    }

    const normalizedRows = rows.map((row) => normalizeBulkRow(row)).filter((row) => !isEmptyRow(row));
    if (!normalizedRows.length) return sendError(res, 400, 'No student rows were found in the uploaded file');

    const selectedSchoolId = req.body?.schoolId || req.body?.selectedSchoolId || req.body?.school || '';
    const selectedDepartmentId = req.body?.departmentId || req.body?.selectedDepartmentId || req.body?.department || '';
    const selectedFacultyId = req.body?.facultyId || req.body?.selectedFacultyId || req.body?.faculty || '';

    if (!selectedSchoolId || !selectedDepartmentId || !selectedFacultyId) {
      return sendError(res, 400, 'Please select a school, department, and faculty before uploading');
    }

    if (req.user?.accountType === 'hod') {
      if (req.user.schoolId && selectedSchoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'HOD accounts can only upload for their own school');
      }
      if (req.user.departmentId && selectedDepartmentId.toString() !== req.user.departmentId.toString()) {
        return sendError(res, 403, 'HOD accounts can only upload for their own department');
      }
      const facultyInScope = await User.findOne({
        _id: selectedFacultyId,
        role: 'faculty',
        departmentId: req.user.departmentId,
      }).lean();
      if (!facultyInScope) {
        return sendError(res, 403, 'Please choose a faculty from your department');
      }
    }

    const [selectedSchool, selectedDepartment, selectedFaculty] = await Promise.all([
      School.findById(selectedSchoolId).select('name').lean().catch(() => null),
      Department.findById(selectedDepartmentId).select('name').lean().catch(() => null),
      User.findById(selectedFacultyId).select('name').lean().catch(() => null),
    ]);

    const summary = {
      totalRows: normalizedRows.length,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      validationErrors: [],
    };

    const seenIdentifiers = new Set();

    for (const [index, row] of normalizedRows.entries()) {
      const rowNumber = index + 2;
      const validationErrors = getRequiredValidationErrors(row);
      if (validationErrors.length) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: validationErrors });
        continue;
      }

      const registerValue = getValue(row, ['register number', 'register no', 'reg no', 'regno', 'reg number', 'registernumber', 'student id', 'studentid']);
      const emailValue = getValue(row, ['email', 'email id', 'emailaddress']);
      const registerKey = String(registerValue);
      const emailKey = String(emailValue).toLowerCase();

      if (seenIdentifiers.has(registerKey) || seenIdentifiers.has(emailKey)) {
        summary.duplicateCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Duplicate register number or email found in the uploaded file'] });
        continue;
      }

      const existingUser = await User.findOne({
        $or: [
          ...(emailKey ? [{ email: emailKey }] : []),
          ...(registerKey ? [{ registerNo: registerKey }, { registerNumber: registerKey }, { regNo: registerKey }] : []),
        ],
      });

      if (existingUser) {
        summary.duplicateCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['A user with the same register number or email already exists'] });
        continue;
      }

      const payload = {
        name: String(getValue(row, ['name', 'full name', 'fullname']) || '').trim(),
        password: String(getValue(row, ['password', 'pwd']) || 'Welcome@123').trim(),
        role: 'student',
        accountType: null,
        email: String(emailValue || '').trim().toLowerCase(),
        registerNo: String(registerKey || '').trim(),
        registerNumber: String(registerKey || '').trim(),
        regNo: String(registerKey || '').trim(),
        school: selectedSchool?.name || '',
        department: selectedDepartment?.name || '',
        schoolId: selectedSchoolId || null,
        departmentId: selectedDepartmentId || null,
        assignedTeacher: selectedFacultyId || null,
        assignedFacultyId: selectedFacultyId || null,
        assignedYear: String(getValue(row, ['assigned year', 'assignedyear', 'year']) || '').trim(),
        year: String(getValue(row, ['year', 'year level', 'stud year']) || '').trim(),
        batch: String(getValue(row, ['batch', 'section batch']) || '').trim(),
        section: String(getValue(row, ['section']) || '').trim(),
        semesterBatch: String(getValue(row, ['semester batch', 'semesterbatch']) || '').trim(),
        recommendedSchool: selectedSchool?.name || '',
        recommendedDepartment: selectedDepartment?.name || '',
        recommendedFaculty: selectedFaculty?.name || '',
      };

      try {
        await User.create(payload);
        summary.successCount += 1;
        seenIdentifiers.add(registerKey);
        seenIdentifiers.add(emailKey);
      } catch (error) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [error.message || 'Unable to create student'] });
      }
    }

    await logAudit(req, {
      action: 'Bulk student upload',
      entityType: 'User',
      details: {
        fileName: fileName || '',
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        duplicateCount: summary.duplicateCount,
      },
    });

    return sendSuccess(res, 200, 'Bulk student upload completed', summary);
  } catch (error) {
    next(error);
  }
};

const listActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find({}).sort({ vertical: 1, activityName: 1 });
    return sendSuccess(res, 200, 'Activities fetched successfully', activities);
  } catch (error) {
    next(error);
  }
};

const createActivity = async (req, res, next) => {
  try {
    const { activityName, vertical, maximumPoints, description, levels, deadline, important } = req.body;
    if (!activityName || !String(activityName).trim()) return sendError(res, 400, 'Activity name is required');
    if (!vertical || !String(vertical).trim()) return sendError(res, 400, 'Vertical is required');
    if (maximumPoints === undefined || maximumPoints === '') return sendError(res, 400, 'Maximum points is required');

    const existing = await Activity.findOne({ activityName: new RegExp(`^${String(activityName).trim()}$`, 'i') });
    if (existing) return sendError(res, 400, 'An activity with that name already exists');

    const normalizedLevels = Array.isArray(levels)
      ? levels
          .filter((level) => level && String(level.label || '').trim() && level.points !== undefined && level.points !== '')
          .map((level) => ({ label: String(level.label).trim(), points: Number(level.points) }))
      : [];

    const activity = await Activity.create({
      activityName: String(activityName).trim(),
      vertical: String(vertical).trim(),
      maximumPoints: Number(maximumPoints),
      description: String(description || '').trim(),
      levels: normalizedLevels,
      deadline: deadline ? new Date(deadline) : null,
      important: Boolean(important),
    });

    await logAudit(req, {
      action: 'Activity created',
      entityType: 'Activity',
      entityId: activity._id,
      details: {
        activityName: activity.activityName,
        vertical: activity.vertical,
        maximumPoints: activity.maximumPoints,
        deadline: activity.deadline ? activity.deadline.toISOString().slice(0, 10) : null,
        important: activity.important,
      },
    });

    return sendSuccess(res, 201, 'Activity created successfully', activity);
  } catch (error) {
    next(error);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return sendError(res, 404, 'Activity not found');

    const updates = {};
    if (req.body.activityName !== undefined) updates.activityName = String(req.body.activityName).trim();
    if (req.body.vertical !== undefined) updates.vertical = String(req.body.vertical).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();
    if (req.body.maximumPoints !== undefined) updates.maximumPoints = Number(req.body.maximumPoints);
    if (req.body.deadline !== undefined) updates.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
    if (req.body.important !== undefined) updates.important = Boolean(req.body.important);
    if (Array.isArray(req.body.levels)) {
      updates.levels = req.body.levels
        .filter((level) => level && String(level.label || '').trim() && level.points !== undefined && level.points !== '')
        .map((level) => ({ label: String(level.label).trim(), points: Number(level.points) }));
    }

    const updated = await Activity.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    await logAudit(req, {
      action: 'Activity updated',
      entityType: 'Activity',
      entityId: req.params.id,
      details: { activityName: updated?.activityName, updatedFields: Object.keys(updates) },
    });

    return sendSuccess(res, 200, 'Activity updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return sendError(res, 404, 'Activity not found');
    await Submission.deleteMany({ activityId: activity._id });
    await logAudit(req, {
      action: 'Activity deleted',
      entityType: 'Activity',
      entityId: req.params.id,
      details: { activityName: activity.activityName },
    });
    return sendSuccess(res, 200, 'Activity and its submissions deleted successfully', { id: req.params.id });
  } catch (error) {
    next(error);
  }
};

const exportAnalytics = async (req, res, next) => {
  try {
    const match = { status: 'Approved' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      const deptIds = await Department.find({ schoolId: req.user.schoolId, status: 'Active' }).select('_id');
      const studentIds = await User.find({ role: 'student', departmentId: { $in: deptIds } }).select('_id');
      match.studentId = { $in: studentIds };
    }
    if (req.user?.accountType === 'hod' && req.user.departmentId) {
      const studentIds = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
      match.studentId = { $in: studentIds };
    }

    const data = await Submission.aggregate([
      { $match: match },
      { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
      { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            vertical: '$activity.vertical',
            department: '$student.department',
            batch: '$student.semesterBatch',
          },
          points: { $sum: '$pointsAwarded' },
          submissions: { $sum: 1 },
        },
      },
      { $sort: { points: -1 } },
    ]);

    const rows = data.map((entry) => ({
      Vertical: entry._id.vertical || '',
      Department: entry._id.department || '',
      Batch: entry._id.batch || '',
      'Points Awarded': entry.points,
      'Submissions Approved': entry.submissions,
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Analytics', `analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const downloadBulkTemplate = async (req, res, next) => {
  try {
    const headers = ['student name', 'reg no', 'email', 'password', 'section', 'year', 'batch'];
    const example = ['A SIVINATH KRISHNA', '2522J0687', 'student@email.com', 'Welcome@123', 'A', '2', '2025-2028'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students-bulk-upload-template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 100));
    const action = req.query.action || '';

    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };

    const [logs, total] = await Promise.all([
      AuditLog.find(query).populate('actorId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(query),
    ]);
    return sendSuccess(res, 200, 'Audit logs fetched', { logs, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const getAcademicSettings = async (req, res, next) => {
  try {
    const [academicYear, semesterOpen] = await Promise.all([
      SystemSetting.findOne({ key: 'academicYear' }).lean(),
      SystemSetting.findOne({ key: 'semesterOpen' }).lean(),
    ]);
    return sendSuccess(res, 200, 'Academic settings fetched', {
      academicYear: academicYear?.value || '',
      semesterOpen: semesterOpen?.value !== false,
    });
  } catch (error) {
    next(error);
  }
};

const updateAcademicSettings = async (req, res, next) => {
  try {
    const { academicYear, semesterOpen } = req.body;
    if (academicYear !== undefined) {
      await SystemSetting.findOneAndUpdate(
        { key: 'academicYear' },
        { $set: { value: String(academicYear).trim() } },
        { upsert: true, new: true }
      );
    }
    if (semesterOpen !== undefined) {
      await SystemSetting.findOneAndUpdate(
        { key: 'semesterOpen' },
        { $set: { value: Boolean(semesterOpen) } },
        { upsert: true, new: true }
      );
    }
    await logAudit(req, {
      action: 'Academic settings updated',
      entityType: 'SystemSetting',
      details: { academicYear, semesterOpen },
    });
    return sendSuccess(res, 200, 'Academic settings updated successfully', { academicYear, semesterOpen });
  } catch (error) {
    next(error);
  }
};

const rolloverAcademicYear = async (req, res, next) => {
  try {
    const { newAcademicYear, targetBatch } = req.body;
    if (!newAcademicYear || !String(newAcademicYear).trim()) {
      return sendError(res, 400, 'A new academic year is required for rollover');
    }

    const query = { role: 'student' };
    if (targetBatch) query.semesterBatch = targetBatch;

    const students = await User.find(query).select('_id year batch semesterBatch');
    let promoted = 0;
    for (const student of students) {
      const numericYear = parseInt(String(student.year || ''), 10);
      const nextYear = Number.isFinite(numericYear) ? numericYear + 1 : numericYear;
      await User.updateOne(
        { _id: student._id },
        { $set: { year: Number.isFinite(nextYear) ? String(nextYear) : student.year, academicYear: String(newAcademicYear).trim() } }
      );
      promoted += 1;
    }

    await SystemSetting.findOneAndUpdate(
      { key: 'academicYear' },
      { $set: { value: String(newAcademicYear).trim() } },
      { upsert: true, new: true }
    );

    await logAudit(req, {
      action: 'Academic year rollover',
      entityType: 'User',
      details: { newAcademicYear, targetBatch: targetBatch || 'all', studentsPromoted: promoted },
    });

    return sendSuccess(res, 200, `Academic year rolled over to ${newAcademicYear} — ${promoted} student${promoted === 1 ? '' : 's'} promoted`, { promoted });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  exportUsers,
  getUserById,
  createDepartment,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getAnalytics,
  getLookups,
  createBulkUsers,
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  exportAnalytics,
  downloadBulkTemplate,
  getAuditLogs,
  getAcademicSettings,
  updateAcademicSettings,
  rolloverAcademicYear,
};
