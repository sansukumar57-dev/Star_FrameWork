const Submission = require('../models/Submission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { reviewSubmission, getProvider } = require('../services/aiReviewService');
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
      Submission.countDocuments({ status: 'Approved', studentId: { $in: facultyStudentIds } }),
      Submission.countDocuments({ status: 'Rejected', studentId: { $in: facultyStudentIds } }),
      User.countDocuments({ role: 'student', assignedFacultyId: req.user.id }),
      Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: facultyStudentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } }
      ])
    ]);

    return sendSuccess(res, 200, 'Dashboard stats fetched successfully', {
      pending,
      approved,
      rejected,
      totalStudents,
      totalPointsAwarded: totalPoints[0]?.total || 0
    });
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

module.exports = { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, runAiReview, applyAiReview };
