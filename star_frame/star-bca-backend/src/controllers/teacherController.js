const { body, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const XLSX = require('xlsx');
const { normalizeBulkRow, isEmptyRow, getValue } = require('../utils/bulkUploadUtils');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { reviewSubmission, getProvider } = require('../services/aiReviewService');
const { logAudit } = require('../utils/audit');
const { notifySubmissionStatus } = require('../utils/notify');
const { EARNED_STATUSES } = require('../utils/approvalStatuses');
const { syncStudentPoints } = require('../services/gamificationService');

const sanitizeSubmission = (submission) => {
  const plainObject = submission?.toObject ? submission.toObject() : { ...submission };

  if (plainObject.certificateFile && typeof plainObject.certificateFile === 'object' && plainObject.certificateFile.data) {
    plainObject.certificateFile = {
      fileName: plainObject.certificateFile.fileName || '',
      contentType: plainObject.certificateFile.contentType || '',
      size: plainObject.certificateFile.size || plainObject.certificateFile.data.length || 0,
    };
  }

  return plainObject;
};

const getFacultyStudentIds = async (facultyId) => {
  const students = await User.find({ role: 'student', assignedFacultyId: facultyId }).select('_id');
  return students.map((student) => student._id);
};

const validateFacultyAccess = async (submission, facultyId) => {
  const student = await User.findById(submission.studentId).select('assignedFacultyId');
  if (!student) {
    return false;
  }

  return student.assignedFacultyId?.toString() === facultyId.toString();
};

const getPendingSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'Pending';
    const search = req.query.search || '';

    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const query = { status, studentId: { $in: facultyStudentIds } };

    if (search) {
      const matchedStudents = await User.find({
        role: 'student',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { regNo: { $regex: search, $options: 'i' } },
          { registerNumber: { $regex: search, $options: 'i' } }
        ],
        assignedFacultyId: req.user.id,
      }).select('_id');

      query.studentId = { $in: matchedStudents.map((student) => student._id) };
    }

    const submissions = await Submission.find(query)
      .populate('studentId', 'name regNo department semesterBatch section')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sanitizedSubmissions = submissions.map((submission) => sanitizeSubmission(submission));
    const total = await Submission.countDocuments(query);

    return sendSuccess(res, 200, 'Pending submissions fetched successfully', { submissions: sanitizedSubmissions, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const exportSubmissions = async (req, res, next) => {
  try {
    const status = req.query.status || 'Pending';
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const submissions = await Submission.find({ status, studentId: { $in: facultyStudentIds } })
      .populate('studentId', 'name regNo registerNumber department section')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 });

    const rows = submissions.map((sub) => ({
      Student: sub.studentId?.name || '',
      'Register Number': sub.studentId?.registerNumber || sub.studentId?.regNo || '',
      Activity: sub.activityId?.activityName || '',
      'Activity Type': sub.activityType || sub.visitType || '',
      Level: sub.selectedLevel || '',
      'Duration (weeks)': sub.durationWeeks || '',
      'Project URL': sub.projectUrl || sub.proofUrl || '',
      Status: sub.status || '',
      'Points Awarded': sub.pointsAwarded ?? 0,
      'Suggested Points': sub.suggestedPoints ?? 0,
      'Submitted At': sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '',
      Remarks: sub.teacherRemarks || '',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Submissions', `submissions-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const getSubmissionDetails = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('studentId', 'name regNo department semesterBatch section')
      .populate('activityId', 'activityName maximumPoints');

    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    return sendSuccess(res, 200, 'Submission details fetched successfully', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const approveSubmission = async (req, res, next) => {
  try {
    const { pointsAwarded, teacherRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    const activity = await Activity.findById(submission.activityId);
    if (!activity) return sendError(res, 404, 'Activity not found');

    const calculated = calculateSubmissionScore(activity, submission);
    const safePoints = Number(pointsAwarded ?? calculated.suggestedPoints ?? calculated.pointsAwarded ?? 0);

    if (safePoints > activity.maximumPoints) {
      return sendError(res, 400, 'Points awarded cannot exceed maximum points for the activity');
    }

    submission.status = 'FacultyApproved';
    submission.suggestedPoints = calculated.suggestedPoints;
    submission.pointsAwarded = safePoints;
    submission.teacherRemarks = teacherRemarks || calculated.scoreSummary;
    submission.verifiedBy = req.user.id;
    submission.verifiedAt = new Date();
    await submission.save();

    await syncStudentPoints(submission.studentId);

    await logAudit(req, {
      action: 'Submission approved by faculty',
      entityType: 'Submission',
      entityId: submission._id,
      details: { activity: activity.activityName, pointsAwarded: safePoints },
    });
    await notifySubmissionStatus({ submission, action: 'faculty-approved', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission approved — pending HOD verification', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const rejectSubmission = async (req, res, next) => {
  try {
    const { teacherRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    submission.status = 'Rejected';
    submission.teacherRemarks = teacherRemarks || 'Please resubmit with clearer evidence.';
    submission.verifiedBy = req.user.id;
    submission.verifiedAt = new Date();
    submission.pointsAwarded = 0;
    await submission.save();

    await syncStudentPoints(submission.studentId);

    await logAudit(req, {
      action: 'Submission rejected by faculty',
      entityType: 'Submission',
      entityId: submission._id,
      details: { teacherRemarks: submission.teacherRemarks },
    });
    await notifySubmissionStatus({ submission, action: 'rejected', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission rejected successfully', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const bulkApproveSubmissions = async (req, res, next) => {
  try {
    const { ids = [], pointsAwarded, teacherRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    let approved = 0;
    for (const submission of submissions) {
      if (submission.status !== 'Pending') continue;
      const allowed = await validateFacultyAccess(submission, req.user.id);
      if (!allowed) continue;

      const activity = await Activity.findById(submission.activityId);
      const calculated = calculateSubmissionScore(activity, submission);
      const safePoints = Number(pointsAwarded ?? calculated.suggestedPoints ?? calculated.pointsAwarded ?? 0);
      if (activity && safePoints > activity.maximumPoints) continue;

      submission.status = 'FacultyApproved';
      submission.suggestedPoints = calculated.suggestedPoints;
      submission.pointsAwarded = safePoints;
      submission.teacherRemarks = teacherRemarks || calculated.scoreSummary;
      submission.verifiedBy = req.user.id;
      submission.verifiedAt = new Date();
      await submission.save();
      await notifySubmissionStatus({ submission, action: 'faculty-approved', actorName: req.user.name });
      approved += 1;
    }

    const approvedStudentIds = [...new Set(submissions.map((s) => s.studentId).filter(Boolean))];
    await Promise.all(approvedStudentIds.map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk approved submissions',
      entityType: 'Submission',
      entityId: ids,
      details: { approved },
    });

    return sendSuccess(res, 200, `${approved} submission${approved === 1 ? '' : 's'} approved — pending HOD verification`, { approved });
  } catch (error) {
    next(error);
  }
};

const bulkRejectSubmissions = async (req, res, next) => {
  try {
    const { ids = [], teacherRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    let rejected = 0;
    for (const submission of submissions) {
      if (submission.status !== 'Pending') continue;
      const allowed = await validateFacultyAccess(submission, req.user.id);
      if (!allowed) continue;

      submission.status = 'Rejected';
      submission.teacherRemarks = teacherRemarks || 'Please resubmit with clearer evidence.';
      submission.verifiedBy = req.user.id;
      submission.verifiedAt = new Date();
      submission.pointsAwarded = 0;
      await submission.save();
      await notifySubmissionStatus({ submission, action: 'rejected', actorName: req.user.name });
      rejected += 1;
    }

    const rejectedStudentIds = [...new Set(submissions.map((s) => s.studentId).filter(Boolean))];
    await Promise.all(rejectedStudentIds.map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk rejected submissions',
      entityType: 'Submission',
      entityId: ids,
      details: { rejected },
    });

    return sendSuccess(res, 200, `${rejected} submission${rejected === 1 ? '' : 's'} rejected`, { rejected });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const [pending, approved, rejected, totalStudents, totalPoints] = await Promise.all([
      Submission.countDocuments({ status: 'Pending', studentId: { $in: facultyStudentIds } }),
      Submission.countDocuments({ status: { $in: EARNED_STATUSES }, studentId: { $in: facultyStudentIds } }),
      Submission.countDocuments({ status: 'Rejected', studentId: { $in: facultyStudentIds } }),
      User.countDocuments({ role: 'student', assignedFacultyId: req.user.id }),
      Submission.aggregate([
        { $match: { status: { $in: EARNED_STATUSES }, studentId: { $in: facultyStudentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } }
      ])
    ]);

    const [topPoints] = await Promise.all([
      Submission.aggregate([
        { $match: { status: { $in: EARNED_STATUSES }, studentId: { $in: facultyStudentIds } } },
        { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const topStudentRows = await User.find({ _id: { $in: topPoints.map((row) => row._id) } })
      .select('name regNo registerNumber section')
      .lean();
    const pointMap = new Map(topPoints.map((row) => [String(row._id), row.totalPoints || 0]));
    const topStudents = topStudentRows
      .map((student) => ({
        _id: student._id,
        name: student.name,
        registerNumber: student.registerNumber || student.regNo || '',
        section: student.section || '',
        totalPoints: pointMap.get(String(student._id)) || 0,
      }))
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    return sendSuccess(res, 200, 'Dashboard stats fetched successfully', {
      pending,
      approved,
      rejected,
      totalStudents,
      totalPointsAwarded: totalPoints[0]?.total || 0,
      topStudents,
    });
  } catch (error) {
    next(error);
  }
};

const getFacultyProfile = async (req, res, next) => {
  try {
    const faculty = await User.findOne({ _id: req.user.id, role: 'faculty' }).select('-password');
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }

    return sendSuccess(res, 200, 'Faculty profile fetched successfully', faculty);
  } catch (error) {
    next(error);
  }
};

const updateFacultyProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array()[0].msg);

    const { name, phoneNumber, dob } = req.body;
    const updateData = {};

    if (typeof name !== 'undefined') updateData.name = name;
    if (typeof phoneNumber !== 'undefined') updateData.phoneNumber = phoneNumber;
    if (typeof dob !== 'undefined') updateData.dob = dob;

    const updatedFaculty = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'faculty' },
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedFaculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }

    return sendSuccess(res, 200, 'Faculty profile updated successfully', updatedFaculty);
  } catch (error) {
    next(error);
  }
};

const getFacultyStudents = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const studentQuery = { role: 'student', assignedFacultyId: req.user.id };

    if (search) {
      studentQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { regNo: { $regex: search, $options: 'i' } },
        { registerNumber: { $regex: search, $options: 'i' } },
        { registernumber: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await User.find(studentQuery)
      .select('name regNo registerNumber section attendancePercentage semesterPercentage libraryUsage')
      .sort({ name: 1 })
      .lean();

    const studentIds = students.map((student) => student._id);
    const pointRows = await Submission.aggregate([
      { $match: { status: { $in: EARNED_STATUSES }, studentId: { $in: studentIds } } },
      { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
    ]);
    const pointMap = new Map(pointRows.map((row) => [String(row._id), row.totalPoints || 0]));

    const result = students.map((student) => ({
      _id: student._id,
      name: student.name,
      registerNumber: student.registerNumber || student.regNo || '',
      section: student.section || '',
      totalPoints: pointMap.get(String(student._id)) || 0,
      attendancePercentage: student.attendancePercentage ?? null,
      semesterPercentage: student.semesterPercentage ?? null,
      libraryUsage: student.libraryUsage ?? null,
    }));

    return sendSuccess(res, 200, 'Students fetched successfully', { students: result });
  } catch (error) {
    next(error);
  }
};

const updateStudentRecords = async (req, res, next) => {
  try {
    const { attendancePercentage, semesterPercentage, libraryUsage } = req.body;
    const student = await User.findOne({ _id: req.params.id, role: 'student', assignedFacultyId: req.user.id });
    if (!student) return sendError(res, 404, 'Student not found in your assigned list');

    const sanitize = (value, max) => {
      if (value === undefined || value === null || value === '') return null;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error('Records must be numeric values');
      return Math.min(max, Math.max(0, numeric));
    };

    try {
      if (attendancePercentage !== undefined) student.attendancePercentage = sanitize(attendancePercentage, 100);
      if (semesterPercentage !== undefined) student.semesterPercentage = sanitize(semesterPercentage, 100);
      if (libraryUsage !== undefined) student.libraryUsage = sanitize(libraryUsage, 1000);
    } catch (error) {
      return sendError(res, 400, error.message);
    }

    await student.save();
    await logAudit(req, {
      action: 'Academic records updated',
      entityType: 'Student',
      entityId: student._id,
      details: {
        name: student.name,
        attendancePercentage: student.attendancePercentage,
        semesterPercentage: student.semesterPercentage,
        libraryUsage: student.libraryUsage,
      },
    });

    return sendSuccess(res, 200, 'Student records updated successfully', {
      attendancePercentage: student.attendancePercentage,
      semesterPercentage: student.semesterPercentage,
      libraryUsage: student.libraryUsage,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAssignedStudent = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student', assignedFacultyId: req.user.id });
    if (!student) return sendError(res, 404, 'Student not found in your assigned list');

    await Submission.deleteMany({ studentId: student._id });
    await student.deleteOne();

    await logAudit(req, {
      action: 'Student deleted by faculty',
      entityType: 'Student',
      entityId: student._id,
      details: { name: student.name, registerNumber: student.registerNumber || student.regNo || '' },
    });

    return sendSuccess(res, 200, 'Student deleted successfully', { id: req.params.id });
  } catch (error) {
    next(error);
  }
};

const bulkUpdateStudentRecords = async (req, res, next) => {
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

    const summary = { totalRows: normalizedRows.length, updatedCount: 0, skippedCount: 0, errors: [] };

    for (const [index, row] of normalizedRows.entries()) {
      const rowNumber = index + 2;
      const registerValue = getValue(row, ['register number', 'register no', 'reg no', 'regno', 'reg number', 'registernumber', 'student id', 'studentid']);
      const registerKey = String(registerValue || '').trim();
      if (!registerKey) {
        summary.skippedCount += 1;
        summary.errors.push({ rowNumber, errors: ['Register number is missing'] });
        continue;
      }

      const attendanceValue = getValue(row, ['attendance', 'attendance %', 'attendance percentage', 'attendance percentage (%)']);
      const semesterValue = getValue(row, ['semester', 'semester %', 'semester percentage', 'semester percentage (%)', 'semester exam percentage']);
      const libraryValue = getValue(row, ['library', 'library hours', 'library usage', 'library usage (hours)', 'library hrs']);

      const student = await User.findOne({ role: 'student', assignedFacultyId: req.user.id, $or: [{ registerNo: registerKey }, { registerNumber: registerKey }, { regNo: registerKey }] });
      if (!student) {
        summary.skippedCount += 1;
        summary.errors.push({ rowNumber, errors: [`No assigned student found for register number ${registerKey}`] });
        continue;
      }

      const parse = (value) => {
        if (value === undefined || value === null || String(value).trim() === '') return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : NaN;
      };

      const attendance = parse(attendanceValue);
      const semester = parse(semesterValue);
      const library = parse(libraryValue);

      if (Number.isNaN(attendance) || Number.isNaN(semester) || Number.isNaN(library)) {
        summary.skippedCount += 1;
        summary.errors.push({ rowNumber, errors: ['Record values must be numeric'] });
        continue;
      }

      if (attendance !== null) student.attendancePercentage = Math.min(100, Math.max(0, attendance));
      if (semester !== null) student.semesterPercentage = Math.min(100, Math.max(0, semester));
      if (library !== null) student.libraryUsage = Math.min(1000, Math.max(0, library));
      await student.save();
      summary.updatedCount += 1;
    }

    await logAudit(req, {
      action: 'Bulk academic records upload',
      entityType: 'Student',
      entityId: [],
      details: summary,
    });

    return sendSuccess(res, 200, `${summary.updatedCount} student record${summary.updatedCount === 1 ? '' : 's'} updated`, summary);
  } catch (error) {
    next(error);
  }
};

const exportTeacherReport = async (req, res, next) => {
  try {
    const faculty = await User.findById(req.user.id).select('-password');
    if (!faculty) return sendError(res, 404, 'Faculty profile not found');

    const [students, submissions] = await Promise.all([
      User.find({ role: 'student', $or: [{ assignedFacultyId: req.user.id }, { assignedTeacher: req.user.id }] })
        .select('name regNo registerNumber section batch semesterBatch')
        .sort({ name: 1 })
        .lean(),
      Submission.find({ verifiedBy: req.user.id, status: { $in: ['Pending', 'Approved', 'Rejected', 'HODPending', 'HODRejected'] } })
        .populate('activityId', 'activityName vertical')
        .sort({ submittedAt: -1 })
        .lean(),
    ]);

    const statusCounts = {
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      HODPending: 0,
      HODRejected: 0,
    };
    submissions.forEach((sub) => {
      if (statusCounts[sub.status] !== undefined) statusCounts[sub.status] += 1;
    });

    const pointResults = await Submission.aggregate([
      { $match: { status: { $in: EARNED_STATUSES }, verifiedBy: req.user.id } },
      { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
    ]);
    const pointMap = new Map(pointResults.map((entry) => [entry._id.toString(), entry.totalPoints || 0]));
    const topStudents = students
      .map((student) => ({
        name: student.name,
        registerNumber: student.registerNumber || student.regNo || '',
        totalPoints: pointMap.get(student._id.toString()) || 0,
      }))
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
      .slice(0, 5);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="faculty-report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#111827').text('STARS-BCA Faculty Report');
    doc.fontSize(9).fillColor('#6b7280').text('KPR College of Arts and Science · STAR Framework Management System');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#6b7280').text(`Generated ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(0.4);
    doc.moveTo(48, doc.y).lineTo(552, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    [
      ['Faculty', faculty.name || '—'],
      ['Department', faculty.department || '—'],
      ['School', faculty.school || '—'],
      ['Assigned Students', String(students.length)],
    ].forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#6b7280').text(label.padEnd(22, ' '), { continued: true }).fillColor('#111827').text(value);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Submission Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#6b7280').text('Pending review: ', { continued: true }).fillColor('#111827').text(`${statusCounts.Pending}`);
    doc.fontSize(10).fillColor('#6b7280').text('Approved: ', { continued: true }).fillColor('#111827').text(`${statusCounts.Approved}`);
    doc.fontSize(10).fillColor('#6b7280').text('Rejected: ', { continued: true }).fillColor('#111827').text(`${statusCounts.Rejected}`);
    doc.fontSize(10).fillColor('#6b7280').text('Awaiting HOD approval: ', { continued: true }).fillColor('#111827').text(`${statusCounts.HODPending}`);
    doc.fontSize(10).fillColor('#6b7280').text('Rejected by HOD: ', { continued: true }).fillColor('#111827').text(`${statusCounts.HODRejected}`);

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Top Students');
    doc.moveDown(0.3);
    if (topStudents.length) {
      topStudents.forEach((student, index) => {
        doc.fontSize(9).fillColor('#6b7280').text(`${index + 1}. `, { continued: true }).fillColor('#111827').text(`${student.name} (${student.registerNumber || '—'}) — ${student.totalPoints} pts`);
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No approved points yet.');
    }

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Recent Submissions');
    doc.moveDown(0.3);
    if (submissions.length) {
      submissions.slice(0, 25).forEach((sub, index) => {
        const status = sub.status || 'Pending';
        doc.fontSize(9).fillColor('#6b7280').text(`${index + 1}. `, { continued: true }).fillColor('#111827').text(
          `${sub.activityId?.activityName || 'Activity'} — ${status}${sub.pointsAwarded ? ` (${sub.pointsAwarded} pts)` : ''}`
        );
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No submissions yet.');
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

const runAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    const review = await reviewSubmission(submission._id);
    const provider = getProvider();
    return sendSuccess(res, 200, `AI review completed (${provider || 'rule engine'})`, {
      ...review,
      submissionId: submission._id,
    });
  } catch (error) {
    next(error);
  }
};

const applyAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    if (!submission.aiReview) return sendError(res, 400, 'No AI review is available for this submission');

    const activity = await Activity.findById(submission.activityId);
    const maxPoints = Number(activity?.maximumPoints || 0);
    const suggestedPoints = Math.min(Number(submission.aiReview.suggestedPoints || 0), maxPoints);

    submission.suggestedPoints = suggestedPoints;
    submission.teacherRemarks = submission.aiReview.reasoning || submission.teacherRemarks;
    await submission.save();

    return sendSuccess(res, 200, 'AI suggestion applied — review and confirm', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const getAiClearedCount = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const count = await Submission.countDocuments({
      status: 'Pending',
      studentId: { $in: facultyStudentIds },
      'aiReview.recommendation': 'Approve',
      'aiReview.confidence': { $gte: 85 },
    });
    return sendSuccess(res, 200, 'AI cleared count fetched', { count });
  } catch (error) {
    next(error);
  }
};

const autoApproveAiCleared = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const submissions = await Submission.find({
      status: 'Pending',
      studentId: { $in: facultyStudentIds },
      'aiReview.recommendation': 'Approve',
      'aiReview.confidence': { $gte: 85 },
    });

    if (submissions.length === 0) {
      return sendSuccess(res, 200, 'No AI-cleared submissions found', { approved: 0 });
    }

    let approved = 0;
    for (const submission of submissions) {
      const activity = await Activity.findById(submission.activityId);
      const calculated = calculateSubmissionScore(activity, submission);
      const safePoints = Math.min(
        Number(submission.aiReview.suggestedPoints ?? calculated.suggestedPoints ?? 0),
        Number(activity?.maximumPoints || 0)
      );

      submission.status = 'FacultyApproved';
      submission.suggestedPoints = calculated.suggestedPoints;
      submission.pointsAwarded = safePoints;
      submission.teacherRemarks = `AI auto-approved (${submission.aiReview.confidence}% confidence): ${submission.aiReview.reasoning || ''}`.slice(0, 500);
      submission.verifiedBy = req.user.id;
      submission.verifiedAt = new Date();
      await submission.save();
      await notifySubmissionStatus({ submission, action: 'faculty-approved', actorName: req.user.name });
      approved += 1;
    }

    await logAudit(req, {
      action: 'AI auto-approved submissions',
      entityType: 'Submission',
      details: { approved },
    });

    return sendSuccess(res, 200, `${approved} submission${approved === 1 ? '' : 's'} auto-approved by AI`, { approved });
  } catch (error) {
    next(error);
  }
};

const teacherValidators = {
  updateProfile: [
    body('name').optional().isString().withMessage('Name must be a string'),
    body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
    body('dob').optional().isString().withMessage('Date of birth must be a string'),
  ],
};

module.exports = { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, getFacultyProfile, updateFacultyProfile, getFacultyStudents, updateStudentRecords, bulkUpdateStudentRecords, deleteAssignedStudent, runAiReview, applyAiReview, exportTeacherReport, getAiClearedCount, autoApproveAiCleared, teacherValidators };
