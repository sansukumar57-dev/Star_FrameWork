const mongoose = require('mongoose');
const User = require('../models/User');
const Submission = require('../models/Submission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { body, validationResult } = require('express-validator');
const { reviewSubmission } = require('../services/aiReviewService');
const { checkForDuplicate, isImageContentType, computeImageHash } = require('../services/duplicateDetectionService');
const { logAudit } = require('../utils/audit');
const { createNotification, notifySubmissionStatus } = require('../utils/notify');
const { scanBuffer } = require('../services/virusScanService');
const { EARNED_STATUSES } = require('../utils/approvalStatuses');

const EVIDENCE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const EVIDENCE_MAX_BYTES = 100 * 1024 * 1024;

const signatureOf = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  const hex = (offset, length) => buffer.toString('hex', offset, offset + length);
  if (hex(0, 4) === '25504446') return 'pdf';
  if (hex(0, 3) === 'ffd8ff') return 'jpeg';
  if (hex(0, 4) === '89504e47') return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'video';
  if (hex(0, 4) === '1a45dfa3') return 'video';
  if (buffer.toString('ascii', 0, 4) === 'PK') return 'zip';
  if (hex(0, 8) === 'd0cf11e0a1b11ae1') return 'ole';
  return null;
};

const validateEvidenceFile = (file) => {
  if (!file) return null;
  const extOk = /\.(pdf|png|jpe?g|webp|docx?|mp4|webm|mov)$/i.test(file.originalname || '');
  const mimeOk = EVIDENCE_TYPES.includes(String(file.mimetype || '').toLowerCase());
  if (!extOk && !mimeOk) return 'Only PDF, PNG, JPG, WEBP, Word documents, or videos (MP4/WEBM/MOV) are allowed for evidence';
  if (file.size > EVIDENCE_MAX_BYTES) return 'File size must be less than 100MB';

  const signature = signatureOf(file.buffer);
  const name = String(file.originalname || '').toLowerCase();
  if (name.endsWith('.pdf') && signature !== 'pdf') return 'The uploaded PDF file appears to be invalid or corrupted';
  if (/\.(jpe?g)$/.test(name) && signature !== 'jpeg') return 'The uploaded JPEG file appears to be invalid or corrupted';
  if (name.endsWith('.png') && signature !== 'png') return 'The uploaded PNG file appears to be invalid or corrupted';
  if (name.endsWith('.webp') && signature !== 'webp') return 'The uploaded WEBP file appears to be invalid or corrupted';
  if (/\.(mp4|webm|mov)$/.test(name) && signature !== 'video') return 'The uploaded video file appears to be invalid or corrupted';
  if (name.endsWith('.docx') && signature !== 'zip') return 'The uploaded DOCX file appears to be invalid or corrupted';
  if (name.endsWith('.doc') && signature !== 'ole') return 'The uploaded DOC file appears to be invalid or corrupted';

  return null;
};

const buildEvidenceFile = (req) => {
  if (!req.file) return null;
  const originalName = String(req.file.originalname || '').trim();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${req.user?.registerNo || req.user?.registerNumber || 'student'}-${Date.now()}-${safeName}`;
  return {
    fileName: uniqueName,
    originalName: safeName,
    contentType: req.file.mimetype,
    data: req.file.buffer,
    size: req.file.buffer?.length || 0,
  };
};

const scanEvidence = async (file) => {
  if (!file?.buffer) return null;
  const result = await scanBuffer(file.buffer);
  if (result.skipped) {
    console.log(`[scan] ClamAV not configured — ${file.originalname} passed through without scanning`);
    return null;
  }
  if (!result.clean) {
    return 'The uploaded file was flagged as potentially malicious by the virus scanner and has been rejected';
  }
  return null;
};

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

const getProfile = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.user.id, role: 'student' }).select('-password');
    if (!student) {
      return sendError(res, 404, 'Student profile not found');
    }

    return sendSuccess(res, 200, 'Profile fetched successfully', student);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array()[0].msg);

    const { name, department, school, section, semesterBatch, phoneNumber, dob } = req.body;
    const updateData = {};

    if (typeof name !== 'undefined') updateData.name = name;
    if (typeof department !== 'undefined') updateData.department = department;
    if (typeof school !== 'undefined') updateData.school = school;
    if (typeof section !== 'undefined') updateData.section = section;
    if (typeof semesterBatch !== 'undefined') updateData.semesterBatch = semesterBatch;
    if (typeof phoneNumber !== 'undefined') updateData.phoneNumber = phoneNumber;
    if (typeof dob !== 'undefined') updateData.dob = dob;

    const updatedStudent = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'student' },
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedStudent) {
      return sendError(res, 404, 'Student profile not found');
    }

    return sendSuccess(res, 200, 'Profile updated successfully', updatedStudent);
  } catch (error) {
    next(error);
  }
};

const submitActivity = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array()[0].msg);

    const { activityId, description, proofUrl, activityType, visitType, durationWeeks, projectUrl, selectedLevel } = req.body;
    const fileValidationError = validateEvidenceFile(req.file);
    if (fileValidationError) return sendError(res, 400, fileValidationError);
    const scanError = await scanEvidence(req.file);
    if (scanError) return sendError(res, 400, scanError);
    const certificateFile = buildEvidenceFile(req);

    const normalizedActivityType = String(activityType || '').trim().toLowerCase();
    const normalizedVisitType = String(visitType || '').trim().toLowerCase();
    const normalizedDuration = String(durationWeeks || '').trim();
    const normalizedProjectUrl = String(projectUrl || proofUrl || '').trim();

    let activityObjectId = null;
    let activity = null;

    if (activityId) {
      if (mongoose.Types.ObjectId.isValid(activityId)) {
        activityObjectId = new mongoose.Types.ObjectId(activityId);
        activity = await Activity.findById(activityObjectId);
      } else {
        activity = await Activity.findOne({ $or: [{ _id: activityId }, { activityName: activityId }] });
        if (activity) {
          activityObjectId = activity._id;
        }
      }
    }

    if (!activity || !activityObjectId) {
      return sendError(res, 400, 'Invalid activity ID');
    }

    const normalizedActivityName = String(activity.activityName || '').trim().toLowerCase();
    const resolvedActivityType = normalizedActivityType || (
      normalizedActivityName.includes('case study') ? 'case-study' :
      normalizedActivityName.includes('mini project') ? 'mini-project' :
      normalizedActivityName.includes('internship') ? 'internship' :
      normalizedActivityName.includes('industrial visit') ? 'industrial-visit' :
      normalizedActivityName.includes('institutional visit') ? 'institutional-visit' :
      normalizedActivityName.includes('international visit') ? 'international-visit' :
      ''
    );

    const resolvedVisitType = normalizedVisitType || (
      normalizedActivityName.includes('industrial visit') ? 'industrial visit' :
      normalizedActivityName.includes('institutional visit') ? 'institutional visit' :
      normalizedActivityName.includes('international visit') ? 'international visit' :
      ''
    );

    const hasDocumentUpload = Boolean(certificateFile);
    const hasLiveUrl = Boolean(normalizedProjectUrl);
    const verticalStr = String(activity?.vertical || '').toLowerCase();
    const isVertical1 = verticalStr.includes('vertical 1');
    const isVertical2 = verticalStr.includes('vertical 2');

    if (isVertical2 && !selectedLevel) {
      return sendError(res, 400, 'Please select a certification level');
    }

    if (isVertical2 && !hasDocumentUpload) {
      return sendError(res, 400, 'A certificate upload is required for this activity');
    }

    if (isVertical1) {
      if (resolvedActivityType === 'internship' && !hasDocumentUpload) {
        return sendError(res, 400, 'An internship certificate/document upload is required');
      }
      if (resolvedActivityType === 'case-study' && !hasDocumentUpload) {
        return sendError(res, 400, 'A case study document upload is required');
      }
      if (resolvedActivityType === 'internship' && !normalizedDuration) {
        return sendError(res, 400, 'Please choose the internship duration');
      }
      if (resolvedActivityType === 'mini-project' && !hasLiveUrl) {
        return sendError(res, 400, 'Please provide the live project URL');
      }
      if (resolvedVisitType && !hasDocumentUpload) {
        return sendError(res, 400, 'A visit document upload is required');
      }
      if (!hasDocumentUpload && !hasLiveUrl) {
        return sendError(res, 400, 'Either certificate file or proof URL is required');
      }
    }

    const duplicate = await Submission.findOne({ studentId: req.user.id, activityId: activityObjectId, status: { $in: ['Pending', 'Approved'] } });
    const studentUser = await User.findById(req.user.id).select('semesterLocked');
    if (studentUser?.semesterLocked) return sendError(res, 403, 'Semester is locked — you cannot submit new activities');

    if (duplicate) return sendError(res, 400, 'A submission for this activity already exists');

    const studentInputData = {
      activityType: resolvedActivityType,
      visitType: resolvedVisitType,
      durationWeeks: normalizedDuration,
      projectUrl: normalizedProjectUrl,
    };

    const submissionPayload = {
      studentId: req.user.id,
      activityId: activityObjectId,
      activityType: resolvedActivityType,
      visitType: resolvedVisitType,
      durationWeeks: normalizedDuration,
      projectUrl: normalizedProjectUrl,
      certificateFile,
      proofUrl: normalizedProjectUrl,
      description,
      studentInputData,
      selectedLevel: String(selectedLevel || '').trim(),
    };

    const calculated = calculateSubmissionScore(activity, submissionPayload);

    const certificateHash = certificateFile?.data && isImageContentType(certificateFile.contentType)
      ? await computeImageHash(certificateFile.data)
      : null;

    const submission = await Submission.create({
      ...submissionPayload,
      suggestedPoints: calculated.suggestedPoints,
      pointsAwarded: 0,
      certificateImageHash: certificateHash?.structural || '',
      certificateColorHash: certificateHash?.color || '',
    });

    if (certificateHash) {
      checkForDuplicate({
        studentId: req.user.id,
        activityId: activityObjectId,
        buffer: certificateFile.data,
        hash: certificateHash,
      })
        .then((result) => {
          if (!result.checked || !result.isDuplicate || !result.matchedSubmissionId) return;
          return Submission.updateOne({ _id: submission._id }, { $set: { duplicateOf: result.matchedSubmissionId } });
        })
        .catch((error) => console.error('[duplicate] detection failed:', error.message));
    }

    reviewSubmission(submission._id).catch((error) => console.error('[AI] auto review failed:', error.message));

    const responsePayload = sanitizeSubmission(submission);
    return sendSuccess(res, 201, 'Submission uploaded successfully', responsePayload);
  } catch (error) {
    next(error);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search || '';

    const query = { studentId: req.user.id };
    if (status) query.status = status;

    const submissions = await Submission.find(query)
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sanitizedSubmissions = submissions.map((submission) => sanitizeSubmission(submission));
    const total = await Submission.countDocuments(query);

    return sendSuccess(res, 200, 'Submissions fetched successfully', { submissions: sanitizedSubmissions, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const getEarnedPoints = async (req, res, next) => {
  try {
    const result = await Submission.aggregate([
      { $match: { studentId: req.user.id, status: { $in: EARNED_STATUSES } } },
      { $group: { _id: null, totalPoints: { $sum: '$pointsAwarded' } } }
    ]);

    return sendSuccess(res, 200, 'Points fetched successfully', { totalPoints: result[0]?.totalPoints || 0 });
  } catch (error) {
    next(error);
  }
};

const FACULTY_MANAGED_ACTIVITIES = ['Attendance Percentage', 'Semester Exam Percentage', 'Library Usage'];

const getActivities = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const safeLimit = Math.max(1, Math.min(limit, 50));

    const activityQuery = { activityName: { $nin: FACULTY_MANAGED_ACTIVITIES } };
    const activitiesAll = await Activity.find(activityQuery);

    const verticalNumber = (value = '') => {
      const match = String(value).match(/Vertical\s*(\d+)/i);
      return match ? parseInt(match[1], 10) : 99;
    };
    activitiesAll.sort((a, b) => (
      verticalNumber(a.vertical) - verticalNumber(b.vertical) ||
      String(a.activityName).localeCompare(String(b.activityName))
    ));

    const total = activitiesAll.length;
    const activities = activitiesAll.slice((page - 1) * safeLimit, page * safeLimit);

    return sendSuccess(res, 200, 'Activities fetched successfully', { activities, total, page, limit: safeLimit });
  } catch (error) {
    next(error);
  }
};

const resubmitActivity = async (req, res, next) => {
  try {
    const studentUser = await User.findById(req.user.id).select('semesterLocked');
    if (studentUser?.semesterLocked) return sendError(res, 403, 'Semester is locked — you cannot resubmit');

    const submission = await Submission.findOne({ _id: req.params.id, studentId: req.user.id, status: { $in: ['Rejected', 'HODRejected'] } });
    if (!submission) return sendError(res, 404, 'Rejected submission not found');

    const { description, proofUrl, selectedLevel } = req.body;
    const fileValidationError = validateEvidenceFile(req.file);
    if (fileValidationError) return sendError(res, 400, fileValidationError);
    const scanError = await scanEvidence(req.file);
    if (scanError) return sendError(res, 400, scanError);
    const certificateFile = req.file ? buildEvidenceFile(req) : submission.certificateFile;

    submission.status = 'Pending';
    submission.teacherRemarks = '';
    submission.pointsAwarded = 0;
    submission.verifiedBy = null;
    submission.verifiedAt = null;
    submission.submittedAt = new Date();
    if (description) submission.description = description;
    if (proofUrl) submission.proofUrl = proofUrl;
    if (selectedLevel) submission.selectedLevel = selectedLevel;
    if (req.file) submission.certificateFile = certificateFile;

    const certificateHash = req.file && isImageContentType(req.file.mimetype)
      ? await computeImageHash(req.file.buffer)
      : null;
    if (certificateHash) {
      submission.certificateImageHash = certificateHash.structural;
      submission.certificateColorHash = certificateHash.color;
    } else {
      submission.certificateImageHash = '';
      submission.certificateColorHash = '';
      submission.duplicateOf = null;
    }

    await submission.save();

    if (certificateHash) {
      checkForDuplicate({
        studentId: req.user.id,
        activityId: submission.activityId,
        buffer: req.file.buffer,
        hash: certificateHash,
      })
        .then((result) => {
          if (!result.checked) return;
          if (result.isDuplicate && result.matchedSubmissionId) {
            return Submission.updateOne({ _id: submission._id }, { $set: { duplicateOf: result.matchedSubmissionId } });
          }
          return Submission.updateOne({ _id: submission._id }, { $set: { duplicateOf: null } });
        })
        .catch((error) => console.error('[duplicate] detection failed:', error.message));
    }

    reviewSubmission(submission._id).catch((error) => console.error('[AI] auto review failed:', error.message));

    return sendSuccess(res, 200, 'Resubmitted successfully', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const appealSubmission = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!String(reason || '').trim()) return sendError(res, 400, 'Please explain why you are appealing');

    const submission = await Submission.findOne({
      _id: req.params.id,
      studentId: req.user.id,
      status: { $in: ['Rejected', 'HODRejected'] },
    });
    if (!submission) return sendError(res, 404, 'Only rejected submissions can be appealed');

    submission.appeal = {
      reason: String(reason).trim(),
      status: 'Appealed',
      appealedAt: new Date(),
      resolution: '',
      resolvedBy: null,
      resolvedAt: null,
    };
    submission.status = 'Pending';
    submission.teacherRemarks = '';
    submission.hodRemarks = '';
    submission.pointsAwarded = 0;
    submission.verifiedBy = null;
    submission.verifiedAt = null;
    submission.hodVerifiedBy = null;
    submission.hodVerifiedAt = null;
    await submission.save();

    const student = await User.findById(req.user.id).select('name assignedFacultyId departmentId');
    const faculty = student?.assignedFacultyId
      ? await User.findById(student.assignedFacultyId).select('name email')
      : null;
    if (faculty) {
      const activity = await Activity.findById(submission.activityId).select('activityName');
      await createNotification({
        userId: faculty._id,
        type: 'appeal',
        title: 'Student appeal — review needed',
        message: `${student?.name || 'A student'} appealed a rejection for "${activity?.activityName || 'Activity'}". Please re-review the resubmitted evidence.`,
        link: '/faculty/reviews',
      });
    }

    await notifySubmissionStatus({ submission, action: 'appealed' });
    await logAudit(req, {
      action: 'Submission appealed by student',
      entityType: 'Submission',
      entityId: submission._id,
      details: { reason: String(reason).trim() },
    });

    return sendSuccess(res, 200, 'Appeal submitted — your submission is back with your faculty for review', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 50));
    const [notifications, unread, total] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments({ userId: req.user.id, read: false }),
      Notification.countDocuments({ userId: req.user.id }),
    ]);
    return sendSuccess(res, 200, 'Notifications fetched', { notifications, unread, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) return sendError(res, 404, 'Notification not found');
    return sendSuccess(res, 200, 'Notification marked as read', notification);
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    return sendSuccess(res, 200, 'All notifications marked as read', {});
  } catch (error) {
    next(error);
  }
};

const calculateStreak = async (studentId) => {
  const subs = await Submission.find({ studentId, status: { $in: EARNED_STATUSES } }).select('verifiedAt createdAt').lean();
  const weekKeys = new Set();
  subs.forEach((sub) => {
    const date = sub.verifiedAt || sub.createdAt;
    if (!date) return;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const weekNum = Math.floor((d - start) / (7 * 86400000));
    weekKeys.add(`${year}-${weekNum}`);
  });
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  let cursor = Math.floor((now - new Date(Date.UTC(nowYear, 0, 1))) / (7 * 86400000));
  if (!weekKeys.has(`${nowYear}-${cursor}`)) cursor -= 1;
  let streak = 0;
  while (cursor >= 0 && weekKeys.has(`${nowYear}-${cursor}`)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
};

const getLeaderboard = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return sendError(res, 404, 'Student profile not found');

    const batchValue = me.semesterBatch || me.batch || '';
    const yearValue = me.year || '';
    const requestedScope = String(req.query.scope || 'batch').toLowerCase();

    const scopeFilter = { role: 'student', status: 'Active' };
    let scopeLabel = 'all';
    if (requestedScope === 'department' && me.departmentId) {
      scopeFilter.departmentId = me.departmentId;
      scopeLabel = 'department';
    } else if (requestedScope === 'year' && yearValue) {
      scopeFilter.$or = [{ year: yearValue }, { semesterBatch: yearValue }, { batch: yearValue }];
      scopeLabel = 'year';
    } else if (requestedScope === 'all') {
      scopeLabel = 'all';
    } else if (batchValue) {
      scopeFilter.$or = [{ semesterBatch: batchValue }, { batch: batchValue }];
      scopeLabel = 'batch';
    } else if (me.departmentId) {
      scopeFilter.departmentId = me.departmentId;
      scopeLabel = 'department';
    }

    const pointRows = await Submission.aggregate([
      { $match: { status: { $in: EARNED_STATUSES } } },
      { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' }, submissions: { $sum: 1 } } },
    ]);
    const pointsById = new Map(pointRows.map((row) => [String(row._id), row]));

    const students = await User.find(scopeFilter).select('name regNo registerNumber section batch semesterBatch departmentId school').sort({ name: 1 }).lean();
    const leaderboard = students
      .map((s) => ({
        _id: s._id,
        name: s.name,
        registerNumber: s.registerNumber || s.regNo || '',
        section: s.section || '',
        totalPoints: pointsById.get(String(s._id))?.totalPoints || 0,
        submissions: pointsById.get(String(s._id))?.submissions || 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));

    let rank = 0;
    let previous = null;
    leaderboard.forEach((item, index) => {
      if (previous === null || item.totalPoints !== previous) rank = index + 1;
      item.rank = rank;
      previous = item.totalPoints;
    });

    const myEntry = leaderboard.find((item) => String(item._id) === String(req.user.id));
    const streak = await calculateStreak(req.user.id);

    return sendSuccess(res, 200, 'Leaderboard fetched', {
      leaderboard: leaderboard.slice(0, 100),
      total: leaderboard.length,
      myRank: myEntry?.rank || 0,
      myPoints: myEntry?.totalPoints || pointsById.get(String(req.user.id))?.totalPoints || 0,
      streak,
      scope: scopeLabel,
    });
  } catch (error) {
    next(error);
  }
};

const getProgressCard = async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id).select('-password');
    if (!student) return sendError(res, 404, 'Student profile not found');

    const submissions = await Submission.find({ studentId: req.user.id, status: { $in: EARNED_STATUSES } })
      .populate('activityId', 'activityName vertical')
      .sort({ verifiedAt: -1 });

    const totalPoints = submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
    const byVertical = {};
    submissions.forEach((sub) => {
      const vertical = sub.activityId?.vertical || 'General';
      byVertical[vertical] = (byVertical[vertical] || 0) + (sub.pointsAwarded || 0);
    });
    const verticalRows = Object.entries(byVertical).sort((a, b) => b[1] - a[1]);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const filename = `progress-card-${student.registerNumber || student.regNo || 'student'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor('#111827').text('STARS-BCA Progress Card', { align: 'left' });
    doc.fontSize(9).fillColor('#6b7280').text('KPR College of Arts and Science · STAR Framework Management System', { align: 'left' });
    doc.moveDown(0.4);
    doc.moveTo(48, doc.y).lineTo(552, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    const details = [
      ['Name', student.name || '—'],
      ['Register Number', student.registerNumber || student.regNo || '—'],
      ['Department', student.department || '—'],
      ['School', student.school || '—'],
      ['Batch', student.semesterBatch || student.batch || '—'],
      ['Section', student.section || '—'],
      ['Academic Year', student.academicYear || '—'],
    ];
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#6b7280').text(label.padEnd(18, ' '), { continued: true });
      doc.fillColor('#111827').text(value);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#6b7280').text(`Total Points: `, { continued: true }).fillColor('#111827').text(`${totalPoints}`);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#6b7280').text(`Approved Submissions: `, { continued: true }).fillColor('#111827').text(`${submissions.length}`);

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Points by Vertical');
    doc.moveDown(0.3);
    if (verticalRows.length) {
      verticalRows.forEach(([vertical, points]) => {
        doc.fontSize(10).fillColor('#6b7280').text(vertical.padEnd(52, ' '), { continued: true }).fillColor('#111827').text(`${points}`);
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No approved points yet.');
    }

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Approved Submissions');
    doc.moveDown(0.3);
    if (submissions.length) {
      submissions.slice(0, 30).forEach((sub, index) => {
        doc.fontSize(9).fillColor('#6b7280').text(`${index + 1}. `, { continued: true }).fillColor('#111827').text(
          `${sub.activityId?.activityName || 'Activity'} — ${sub.pointsAwarded || 0} pts`
        );
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No approved submissions yet.');
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

const studentValidators = {
  updateProfile: [
    body('name').optional().isString().withMessage('Name must be a string'),
    body('department').optional().isString().withMessage('Department must be a string'),
    body('school').optional().isString().withMessage('School must be a string'),
    body('section').optional().isString().withMessage('Section must be a string'),
    body('semesterBatch').optional().isString().withMessage('Semester batch must be a string'),
    body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
    body('dob').optional().isString().withMessage('Date of birth must be a string')
  ],
  submitActivity: [
    body('activityId')
      .notEmpty().withMessage('Activity ID is required')
      .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid activity ID'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('activityType').optional().isString().withMessage('Activity type must be a string'),
    body('visitType').optional().isString().withMessage('Visit type must be a string'),
    body('durationWeeks').optional().isString().withMessage('Duration must be a string'),
    body('projectUrl').optional().isString().withMessage('Project URL must be a string')
  ]
};

const getDeadlineAlerts = async (req, res, next) => {
  try {
    const alertWindowDays = Math.max(1, parseInt(process.env.DEADLINE_ALERT_WINDOW_DAYS || '7', 10) || 7);
    const now = Date.now();
    const dayMs = 86400000;

    const [activities, approved] = await Promise.all([
      Activity.find({ deadline: { $ne: null } }).select('activityName vertical maximumPoints important deadline').lean(),
      Submission.find({ studentId: req.user.id, status: { $in: EARNED_STATUSES } }).select('activityId').lean(),
    ]);
    const completedIds = new Set(approved.map((sub) => String(sub.activityId)));

    const alerts = [];
    for (const activity of activities) {
      if (completedIds.has(String(activity._id))) continue;
      const deadlineMs = new Date(activity.deadline).getTime();
      if (!Number.isFinite(deadlineMs)) continue;
      const daysLeft = Math.ceil((deadlineMs - now) / dayMs);
      if (daysLeft < 0 || daysLeft > alertWindowDays) continue;

      const tone = daysLeft < 0 ? 'overdue' : activity.important ? 'urgent' : 'warning';
      alerts.push({
        activityId: activity._id,
        activityName: activity.activityName,
        vertical: activity.vertical || '',
        maximumPoints: activity.maximumPoints || 0,
        deadline: activity.deadline,
        daysLeft,
        important: Boolean(activity.important),
        tone,
      });

      const existing = await Notification.findOne({ userId: req.user.id, type: 'deadline', link: String(activity._id) }).lean();
      if (!existing) {
        await Notification.create({
          userId: req.user.id,
          type: 'deadline',
          title: `${tone === 'overdue' ? 'Overdue' : 'Deadline approaching'}: ${activity.activityName}`,
          message: tone === 'overdue'
            ? `The deadline for this activity passed. Submit it as soon as possible to earn up to ${activity.maximumPoints || 0} points.`
            : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — submit evidence to earn up to ${activity.maximumPoints || 0} points.`,
          link: String(activity._id),
        });
      }
    }

    alerts.sort((a, b) => (a.tone === b.tone ? a.deadline - b.deadline : a.tone === 'overdue' ? -1 : b.tone === 'overdue' ? 1 : a.tone === 'urgent' ? -1 : 1));
    return sendSuccess(res, 200, 'Deadline alerts fetched', { alerts, windowDays: alertWindowDays });
  } catch (error) {
    next(error);
  }
};

const getPointsHistory = async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id).select('pointsLedger totalPoints');
    if (!student) return sendError(res, 404, 'Student not found');

    const ledger = (student.pointsLedger || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    return sendSuccess(res, 200, 'Points history fetched', { ledger, totalPoints: student.totalPoints || 0 });
  } catch (error) {
    next(error);
  }
};

const getBookmarks = async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id).select('bookmarks').populate('bookmarks', 'activityName vertical maximumPoints deadline');
    if (!student) return sendError(res, 404, 'Student not found');
    return sendSuccess(res, 200, 'Bookmarks fetched', { bookmarks: student.bookmarks || [] });
  } catch (error) {
    next(error);
  }
};

const toggleBookmark = async (req, res, next) => {
  try {
    const { activityId } = req.body;
    if (!activityId) return sendError(res, 400, 'Activity ID is required');

    const student = await User.findById(req.user.id);
    if (!student) return sendError(res, 404, 'Student not found');

    const idx = student.bookmarks.findIndex((id) => String(id) === String(activityId));
    if (idx >= 0) {
      student.bookmarks.splice(idx, 1);
    } else {
      student.bookmarks.push(activityId);
    }
    await student.save();
    return sendSuccess(res, 200, idx >= 0 ? 'Bookmark removed' : 'Bookmark added', { bookmarks: student.bookmarks });
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!String(text || '').trim()) return sendError(res, 400, 'Comment text is required');

    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const user = await User.findById(req.user.id).select('name role accountType');
    submission.comments.push({
      authorId: req.user.id,
      authorName: user?.name || 'Unknown',
      authorRole: user?.accountType || user?.role || 'student',
      text: String(text).trim(),
    });
    await submission.save();
    return sendSuccess(res, 200, 'Comment added', submission.comments);
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id).select('comments');
    if (!submission) return sendError(res, 404, 'Submission not found');
    return sendSuccess(res, 200, 'Comments fetched', submission.comments || []);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  submitActivity,
  resubmitActivity,
  getMySubmissions,
  getEarnedPoints,
  getActivities,
  appealSubmission,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getLeaderboard,
  getProgressCard,
  getDeadlineAlerts,
  getPointsHistory,
  getBookmarks,
  toggleBookmark,
  addComment,
  getComments,
  studentValidators,
};
