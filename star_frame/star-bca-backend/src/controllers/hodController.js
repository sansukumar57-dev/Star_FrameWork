const Submission = require('../models/Submission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit } = require('../utils/audit');
const { notifySubmissionStatus } = require('../utils/notify');

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

const getFacultyApprovedSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const flagged = req.query.flagged === 'true';

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);
    const query = { status: 'FacultyApproved', studentId: { $in: studentIds } };

    if (flagged) {
      query.$or = [
        { 'aiReview.recommendation': { $in: ['Reject', 'Review'] } },
        { 'aiReview.confidence': { $lt: 70 } },
        { aiReview: null },
      ];
    }

    if (search) {
      const matched = await User.find({
        role: 'student', departmentId: req.user.departmentId,
        $or: [{ name: { $regex: search, $options: 'i' } }, { regNo: { $regex: search, $options: 'i' } }],
      }).select('_id');
      query.studentId = { $in: matched.map((s) => s._id) };
    }

    const submissions = await Submission.find(query)
      .populate('studentId', 'name regNo department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name')
      .sort({ verifiedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Submission.countDocuments(query);
    return sendSuccess(res, 200, 'Faculty-approved submissions fetched', {
      submissions: submissions.map(sanitizeSubmission), total, page, limit,
    });
  } catch (error) {
    next(error);
  }
};

const getSubmissionDetails = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('studentId', 'name regNo department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name');
    if (!submission) return sendError(res, 404, 'Submission not found');
    return sendSuccess(res, 200, 'Details fetched', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const approveSubmission = async (req, res, next) => {
  try {
    const { pointsAwarded, hodRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');
    if (submission.status !== 'FacultyApproved') return sendError(res, 400, 'Only faculty-approved submissions can be HOD-approved');

    const activity = await Activity.findById(submission.activityId);
    const safePoints = Number(pointsAwarded ?? submission.suggestedPoints ?? submission.pointsAwarded ?? 0);
    if (activity && safePoints > activity.maximumPoints) {
      return sendError(res, 400, 'Points cannot exceed maximum for this activity');
    }

    submission.status = 'Approved';
    submission.pointsAwarded = safePoints;
    submission.hodRemarks = hodRemarks || '';
    submission.hodVerifiedBy = req.user.id;
    submission.hodVerifiedAt = new Date();
    await submission.save();

    await logAudit(req, {
      action: 'Submission approved by HOD',
      entityType: 'Submission',
      entityId: submission._id,
      details: { activity: activity?.activityName || '', pointsAwarded: safePoints },
    });
    await notifySubmissionStatus({ submission, action: 'hod-approved', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission approved by HOD', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const rejectSubmission = async (req, res, next) => {
  try {
    const { hodRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');
    if (submission.status !== 'FacultyApproved') return sendError(res, 400, 'Only faculty-approved submissions can be rejected by HOD');

    submission.status = 'HODRejected';
    submission.hodRemarks = hodRemarks || 'Rejected by HOD — please resubmit with proper evidence';
    submission.pointsAwarded = 0;
    submission.hodVerifiedBy = req.user.id;
    submission.hodVerifiedAt = new Date();
    await submission.save();

    await logAudit(req, {
      action: 'Submission rejected by HOD',
      entityType: 'Submission',
      entityId: submission._id,
      details: { hodRemarks: submission.hodRemarks },
    });
    await notifySubmissionStatus({ submission, action: 'hod-rejected', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission rejected by HOD', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const bulkApproveSubmissions = async (req, res, next) => {
  try {
    const { ids = [], pointsAwarded, hodRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id.toString());

    let approved = 0;
    for (const submission of submissions) {
      if (submission.status !== 'FacultyApproved') continue;
      if (!studentIds.includes(submission.studentId?.toString?.())) continue;

      const activity = await Activity.findById(submission.activityId);
      const safePoints = Number(pointsAwarded ?? submission.suggestedPoints ?? submission.pointsAwarded ?? 0);
      if (activity && safePoints > activity.maximumPoints) continue;

      submission.status = 'Approved';
      submission.pointsAwarded = safePoints;
      submission.hodRemarks = hodRemarks || '';
      submission.hodVerifiedBy = req.user.id;
      submission.hodVerifiedAt = new Date();
      await submission.save();
      await notifySubmissionStatus({ submission, action: 'hod-approved', actorName: req.user.name });
      approved += 1;
    }

    await logAudit(req, {
      action: 'Bulk approved by HOD',
      entityType: 'Submission',
      entityId: ids,
      details: { approved },
    });

    return sendSuccess(res, 200, `${approved} submission${approved === 1 ? '' : 's'} approved`, { approved });
  } catch (error) {
    next(error);
  }
};

const bulkRejectSubmissions = async (req, res, next) => {
  try {
    const { ids = [], hodRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id.toString());

    let rejected = 0;
    for (const submission of submissions) {
      if (submission.status !== 'FacultyApproved') continue;
      if (!studentIds.includes(submission.studentId?.toString?.())) continue;

      submission.status = 'HODRejected';
      submission.hodRemarks = hodRemarks || 'Rejected by HOD — please resubmit with proper evidence';
      submission.pointsAwarded = 0;
      submission.hodVerifiedBy = req.user.id;
      submission.hodVerifiedAt = new Date();
      await submission.save();
      await notifySubmissionStatus({ submission, action: 'hod-rejected', actorName: req.user.name });
      rejected += 1;
    }

    await logAudit(req, {
      action: 'Bulk rejected by HOD',
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
    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);

    const [pendingHOD, approved, rejected, totalStudents, totalPoints] = await Promise.all([
      Submission.countDocuments({ status: 'FacultyApproved', studentId: { $in: studentIds } }),
      Submission.countDocuments({ status: 'Approved', studentId: { $in: studentIds } }),
      Submission.countDocuments({ status: { $in: ['Rejected', 'HODRejected'] }, studentId: { $in: studentIds } }),
      User.countDocuments({ role: 'student', departmentId: req.user.departmentId }),
      Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]),
    ]);

    return sendSuccess(res, 200, 'Dashboard stats', {
      pendingHOD, approved, rejected, totalStudents, totalPointsAwarded: totalPoints[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};

const exportSubmissions = async (req, res, next) => {
  try {
    const status = req.query.status || 'FacultyApproved';
    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);

    const submissions = await Submission.find({ status, studentId: { $in: studentIds } })
      .populate('studentId', 'name regNo registerNumber department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name')
      .sort({ verifiedAt: -1 });

    const rows = submissions.map((sub) => ({
      Student: sub.studentId?.name || '',
      'Register Number': sub.studentId?.registerNumber || sub.studentId?.regNo || '',
      Department: sub.studentId?.department || '',
      Section: sub.studentId?.section || '',
      Activity: sub.activityId?.activityName || '',
      'Activity Type': sub.activityType || sub.visitType || '',
      Level: sub.selectedLevel || '',
      'Duration (weeks)': sub.durationWeeks || '',
      'Project URL': sub.projectUrl || sub.proofUrl || '',
      Status: sub.status || '',
      'Points Awarded': sub.pointsAwarded ?? 0,
      'Suggested Points': sub.suggestedPoints ?? 0,
      'Verified By': sub.verifiedBy?.name || '',
      'Verified At': sub.verifiedAt ? new Date(sub.verifiedAt).toLocaleString() : '',
      Remarks: sub.teacherRemarks || '',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Submissions', `hod-submissions-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const lockSemester = async (req, res, next) => {
  try {
    const { batch } = req.body;
    const query = { role: 'student', departmentId: req.user.departmentId };
    if (batch) query.semesterBatch = batch;

    await User.updateMany(query, { $set: { semesterLocked: true } });
    await logAudit(req, { action: 'Semester locked', entityType: 'User', details: { batch: batch || 'all' } });
    return sendSuccess(res, 200, `Semester locked for${batch ? ` batch ${batch}` : ''} all students in your department`);
  } catch (error) {
    next(error);
  }
};

const unlockSemester = async (req, res, next) => {
  try {
    const { batch } = req.body;
    const query = { role: 'student', departmentId: req.user.departmentId };
    if (batch) query.semesterBatch = batch;

    await User.updateMany(query, { $set: { semesterLocked: false } });
    await logAudit(req, { action: 'Semester unlocked', entityType: 'User', details: { batch: batch || 'all' } });
    return sendSuccess(res, 200, `Semester unlocked for${batch ? ` batch ${batch}` : ''} all students in your department`);
  } catch (error) {
    next(error);
  }
};

const runAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const student = await User.findById(submission.studentId).select('departmentId');
    if (!student || String(student.departmentId || '') !== String(req.user.departmentId || '')) {
      return sendError(res, 403, 'Submission outside your department');
    }

    const { reviewSubmission: review, getProvider } = require('../services/aiReviewService');
    const result = await review(submission._id);
    const provider = getProvider();
    return sendSuccess(res, 200, `AI review completed (${provider || 'rule engine'})`, {
      ...result,
      submissionId: submission._id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFacultyApprovedSubmissions,
  getSubmissionDetails,
  approveSubmission,
  rejectSubmission,
  bulkApproveSubmissions,
  bulkRejectSubmissions,
  getDashboardStats,
  exportSubmissions,
  lockSemester,
  unlockSemester,
  runAiReview,
};
