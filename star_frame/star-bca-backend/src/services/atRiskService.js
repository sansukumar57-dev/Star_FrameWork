const User = require('../models/User');
const Submission = require('../models/Submission');
const { createNotification } = require('../utils/notify');

const INACTIVE_DAYS = Number(process.env.AT_RISK_INACTIVE_DAYS || 30);
const HIGH_REJECTION_RATIO = Number(process.env.AT_RISK_REJECTION_RATIO || 0.5);
const DAY_MS = 86400000;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysSince(value) {
  if (!value) return Infinity;
  return (Date.now() - new Date(value).getTime()) / DAY_MS;
}

function scoreStudent({ student, metrics }) {
  const factors = [];
  const totalSubmissions = (metrics?.pending || 0) + (metrics?.rejected || 0) + (metrics?.approved || 0);

  if (totalSubmissions === 0) {
    factors.push('has not submitted any activity yet');
  }
  if ((student.totalPoints || 0) < metrics.medianPoints && totalSubmissions > 0) {
    factors.push('points are below the departmental median');
  }
  if ((student.currentStreak || 0) === 0 && totalSubmissions > 0) {
    factors.push('currently has no active participation streak');
  }
  if (totalSubmissions > 0 && (metrics.rejected / totalSubmissions) > HIGH_REJECTION_RATIO) {
    factors.push(`a high share of submissions are being rejected (${metrics.rejected}/${totalSubmissions})`);
  }
  if (metrics.lastSubmission ? daysSince(metrics.lastSubmission) > INACTIVE_DAYS : totalSubmissions > 0) {
    factors.push(`no submissions in the last ${INACTIVE_DAYS} days`);
  }

  const level = totalSubmissions === 0 || factors.length >= 3
    ? 'High'
    : factors.length === 2
      ? 'Medium'
      : factors.length === 1
        ? 'Low'
        : 'OK';

  return { factors, level, totalSubmissions, lastSubmissionDays: metrics.lastSubmission ? Math.round(daysSince(metrics.lastSubmission)) : null };
}

async function getAtRiskStudents({ scopedSchoolId = null, scopedDepartmentId = null } = {}) {
  const studentQuery = { role: 'student', status: 'Active' };
  if (scopedSchoolId) studentQuery.schoolId = scopedSchoolId;
  if (scopedDepartmentId) studentQuery.departmentId = scopedDepartmentId;

  const students = await User.find(studentQuery)
    .select('name registerNo department school totalPoints currentStreak assignedTeacher assignedFacultyId')
    .lean();
  const ids = students.map((student) => student._id);

  const rows = await Submission.aggregate([
    { $match: { studentId: { $in: ids } } },
    {
      $group: {
        _id: '$studentId',
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'HODRejected']] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $in: ['$status', ['Approved', 'FacultyApproved', 'HODApproved']] }, 1, 0] } },
        lastSubmission: { $max: '$submittedAt' },
      },
    },
  ]);

  const metricsMap = new Map(rows.map((row) => [String(row._id), row]));
  const medianPoints = median(students.map((student) => student.totalPoints || 0));

  const scored = students
    .map((student) => {
      const metrics = metricsMap.get(String(student._id)) || { pending: 0, rejected: 0, approved: 0, lastSubmission: null };
      const result = scoreStudent({ student, metrics: { ...metrics, medianPoints } });
      return {
        studentId: student._id,
        name: student.name,
        registerNo: student.registerNo || '',
        department: student.department || '',
        totalPoints: student.totalPoints || 0,
        currentStreak: student.currentStreak || 0,
        ...result,
        metrics: {
          approved: metrics.approved || 0,
          pending: metrics.pending || 0,
          rejected: metrics.rejected || 0,
        },
      };
    })
    .filter((entry) => entry.level !== 'OK')
    .sort((a, b) => {
      const rank = { High: 0, Medium: 1, Low: 2 };
      return (rank[a.level] ?? 3) - (rank[b.level] ?? 3) || b.totalPoints - a.totalPoints;
    });

  return {
    generatedAt: new Date(),
    medianPoints,
    inactiveDays: INACTIVE_DAYS,
    atRisk: scored,
    counts: {
      high: scored.filter((entry) => entry.level === 'High').length,
      medium: scored.filter((entry) => entry.level === 'Medium').length,
      low: scored.filter((entry) => entry.level === 'Low').length,
      total: scored.length,
    },
  };
}

async function notifyAtRiskStudents({ scopedSchoolId = null, scopedDepartmentId = null, levels = ['High', 'Medium'] } = {}) {
  const { atRisk } = await getAtRiskStudents({ scopedSchoolId, scopedDepartmentId });
  const targets = atRisk.filter((entry) => levels.includes(entry.level));

  let studentNotified = 0;
  let facultyNotified = 0;

  for (const entry of targets) {
    await createNotification({
      userId: entry.studentId,
      type: 'at-risk',
      title: 'Your STAR progress needs attention',
      message: `You have ${entry.factors.length ? '— ' + entry.factors.slice(0, 2).join('; ') : 'fallen behind on your STAR activities'}. Submit evidence for a new activity to keep growing your STAR profile.`,
      link: '/student/activities',
    });
    studentNotified += 1;

    const student = await User.findById(entry.studentId).select('assignedTeacher assignedFacultyId departmentId department schoolId');
    const facultyId = student?.assignedFacultyId || student?.assignedTeacher;
    if (facultyId) {
      await createNotification({
        userId: facultyId,
        type: 'at-risk',
        title: 'At-risk student: needs guidance',
        message: `${entry.name} (${entry.registerNo || entry.department || ''}) is flagged ${entry.level} risk — ${entry.factors.slice(0, 2).join('; ')}. Consider reaching out to help them re-engage.`,
        link: '/faculty/students',
      });
      facultyNotified += 1;
    }
  }

  return { targets: targets.length, studentNotified, facultyNotified, generatedAt: new Date() };
}

module.exports = { getAtRiskStudents, notifyAtRiskStudents, scoreStudent };