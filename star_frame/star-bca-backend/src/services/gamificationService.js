const { User, Badge, UserStreak, Submission } = require('../models');
const { EARNED_STATUSES } = require('../utils/approvalStatuses');

// Badge definitions
const BADGE_DEFINITIONS = {
  FIRST_SUBMISSION: {
    name: 'First Step',
    description: 'Submitted your first evidence',
    icon: '🎯',
    condition: (stats) => stats.totalSubmissions >= 1
  },
  FIVE_SUBMISSIONS: {
    name: 'Rising Star',
    description: 'Completed 5 submissions',
    icon: '⭐',
    condition: (stats) => stats.totalSubmissions >= 5
  },
  TEN_SUBMISSIONS: {
    name: 'Submission Master',
    description: 'Completed 10 submissions',
    icon: '🌟',
    condition: (stats) => stats.totalSubmissions >= 10
  },
  HUNDRED_POINTS: {
    name: 'Century',
    description: 'Earned 100 points',
    icon: '💯',
    condition: (stats) => stats.totalPoints >= 100
  },
  FIVE_HUNDRED_POINTS: {
    name: 'Elite Performer',
    description: 'Earned 500 points',
    icon: '👑',
    condition: (stats) => stats.totalPoints >= 500
  },
  THOUSAND_POINTS: {
    name: 'Legend',
    description: 'Earned 1000 points',
    icon: '🏆',
    condition: (stats) => stats.totalPoints >= 1000
  },
  PERFECT_SCORE: {
    name: 'Perfect Submission',
    description: 'Scored 100% on a submission',
    icon: '💎',
    condition: (stats) => stats.perfectScores >= 1
  },
  WEEKLY_STREAK_7: {
    name: 'Week Warrior',
    description: 'Maintained a 7-day streak',
    icon: '🔥',
    condition: (stats) => stats.longestStreak >= 7
  },
  MONTHLY_STREAK_30: {
    name: 'Monthly Master',
    description: 'Maintained a 30-day streak',
    icon: '💪',
    condition: (stats) => stats.longestStreak >= 30
  },
  ALL_ACTIVITIES_COMPLETE: {
    name: 'Completionist',
    description: 'Completed all available activities',
    icon: '✅',
    condition: (stats) => stats.allActivitiesComplete
  },
  DEPARTMENT_CHAMPION: {
    name: 'Department Champion',
    description: 'Ranked #1 in your department',
    icon: '🥇',
    condition: (stats) => stats.departmentRank === 1
  },
  CONSISTENCY_MASTER: {
    name: 'Consistency Master',
    description: '90% submission approval rate',
    icon: '📈',
    condition: (stats) => {
      if (stats.totalSubmissions === 0) return false;
      return (stats.approvedSubmissions / stats.totalSubmissions) >= 0.9;
    }
  }
};

// Award badges based on user statistics
async function checkAndAwardBadges(studentId, academicYear = '') {
  try {
    const user = await User.findById(studentId);
    if (!user || user.role !== 'student') return [];

    // Get user statistics
    const submissions = await Submission.find({
      studentId,
      academicYear: academicYear || user.academicYear
    });

    const approvedCount = submissions.filter(s => 
      ['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status)
    ).length;

    const totalPoints = submissions.reduce((sum, s) => {
      if (['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status)) {
        return sum + (s.pointsAwarded || s.suggestedPoints || 0);
      }
      return sum;
    }, 0);

    const perfectScores = submissions.filter(s => 
      ['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status) &&
      (s.pointsAwarded || s.suggestedPoints) === (s.activityId?.maximumPoints || 100)
    ).length;

    const userStats = {
      totalSubmissions: submissions.length,
      approvedSubmissions: approvedCount,
      totalPoints,
      perfectScores,
      longestStreak: user.longestStreak || 0,
      allActivitiesComplete: false,
      departmentRank: 1
    };

    const awardedBadges = [];
    
    for (const [badgeType, badgeInfo] of Object.entries(BADGE_DEFINITIONS)) {
      if (!badgeInfo.condition(userStats)) continue;

      // Check if badge already awarded
      const existingBadge = await Badge.findOne({
        studentId,
        badgeType,
        academicYear: academicYear || user.academicYear
      });

      if (!existingBadge) {
        const badge = await Badge.create({
          studentId,
          badgeType,
          badgeName: badgeInfo.name,
          badgeDescription: badgeInfo.description,
          badgeIcon: badgeInfo.icon,
          academicYear: academicYear || user.academicYear
        });
        awardedBadges.push(badge);
      }
    }

    return awardedBadges;
  } catch (error) {
    console.error('Error awarding badges:', error);
    return [];
  }
}

// Rebuild the student's totalPoints and pointsLedger from their Approved submissions.
// Keeps User.totalPoints / pointsLedger in sync with the Submission aggregates used
// by the dashboard, leaderboard and progress card.
async function syncStudentPoints(studentId) {
  try {
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') return null;

    const submissions = await Submission.find({ studentId, status: { $in: EARNED_STATUSES } })
      .populate('activityId', 'activityName vertical')
      .sort({ verifiedAt: -1 });

    const totalPoints = submissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);

    const ledgerMap = new Map((student.pointsLedger || []).map((e) => [String(e.submissionId || ''), e]));

    const ledger = submissions.map((s) => {
      const prior = ledgerMap.get(String(s._id));
      return {
        submissionId: s._id,
        activityName: s.activityId?.activityName || prior?.activityName || 'Activity',
        vertical: s.activityId?.vertical || prior?.vertical || '',
        points: s.pointsAwarded || 0,
        type: 'earned',
        note: s.teacherRemarks || s.hodRemarks || prior?.note || '',
        date: s.hodVerifiedAt || s.verifiedAt || new Date(),
      };
    });

    student.totalPoints = totalPoints;
    student.approvedSubmissions = submissions.length;
    student.totalSubmissions = await Submission.countDocuments({ studentId });
    student.pointsLedger = ledger;
    await student.save();

    return student;
  } catch (error) {
    console.error('Error syncing student points:', error);
    return null;
  }
}

// Update user streak based on activity
async function updateUserStreak(studentId, academicYear = '') {
  try {
    const user = await User.findById(studentId);
    if (!user || user.role !== 'student') return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await UserStreak.findOne({
      studentId,
      academicYear: academicYear || user.academicYear
    });

    if (!streak) {
      streak = await UserStreak.create({
        studentId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
        streakStartDate: today,
        totalActivityDays: 1,
        academicYear: academicYear || user.academicYear
      });
    } else {
      const lastActivity = new Date(streak.lastActivityDate);
      lastActivity.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Same day, no change
        return streak;
      } else if (daysDiff === 1) {
        // Consecutive day
        streak.currentStreak += 1;
        streak.totalActivityDays += 1;
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }
      } else {
        // Streak broken, start new
        streak.currentStreak = 1;
        streak.streakStartDate = today;
        streak.totalActivityDays += 1;
      }
      
      streak.lastActivityDate = today;
      await streak.save();
    }

    // Update user with current streak info
    user.currentStreak = streak.currentStreak;
    user.longestStreak = streak.longestStreak;
    await user.save();

    return streak;
  } catch (error) {
    console.error('Error updating user streak:', error);
    return null;
  }
}

// Get user leaderboard for a department
async function getDepartmentLeaderboard(departmentId, academicYear = '', limit = 10) {
  try {
    const students = await User.find({
      role: 'student',
      departmentId,
      academicYear: academicYear || undefined
    })
      .select('name regNo totalPoints approvedSubmissions currentStreak longestStreak')
      .sort({ totalPoints: -1 })
      .limit(limit);

    return students.map((student, index) => ({
      rank: index + 1,
      ...student.toObject()
    }));
  } catch (error) {
    console.error('Error getting department leaderboard:', error);
    return [];
  }
}

// Get student badges
async function getStudentBadges(studentId, academicYear = '') {
  try {
    const badges = await Badge.find({
      studentId,
      academicYear: academicYear || undefined
    }).sort({ awardedAt: -1 });

    return badges;
  } catch (error) {
    console.error('Error getting student badges:', error);
    return [];
  }
}

// Get student stats for dashboard
async function getStudentStats(studentId) {
  try {
    const user = await User.findById(studentId);
    if (!user) return null;

    const submissions = await Submission.find({ studentId })
      .populate('activityId');

    const approved = submissions.filter(s => 
      ['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status)
    );

    const totalPoints = approved.reduce((sum, s) => 
      sum + (s.pointsAwarded || s.suggestedPoints || 0), 0
    );

    const badges = await getStudentBadges(studentId, user.academicYear);

    return {
      studentName: user.name,
      totalPoints,
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      totalSubmissions: submissions.length,
      approvedSubmissions: approved.length,
      pendingSubmissions: submissions.filter(s => s.status === 'Pending').length,
      badges: badges.map(b => ({
        type: b.badgeType,
        name: b.badgeName,
        icon: b.badgeIcon,
        awardedAt: b.awardedAt
      }))
    };
  } catch (error) {
    console.error('Error getting student stats:', error);
    return null;
  }
}

module.exports = {
  BADGE_DEFINITIONS,
  checkAndAwardBadges,
  updateUserStreak,
  syncStudentPoints,
  getDepartmentLeaderboard,
  getStudentBadges,
  getStudentStats
};
