const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badgeType: { type: String, enum: [
    'FIRST_SUBMISSION',
    'FIVE_SUBMISSIONS',
    'TEN_SUBMISSIONS',
    'HUNDRED_POINTS',
    'FIVE_HUNDRED_POINTS',
    'THOUSAND_POINTS',
    'PERFECT_SCORE',
    'WEEKLY_STREAK_7',
    'MONTHLY_STREAK_30',
    'ALL_ACTIVITIES_COMPLETE',
    'DEPARTMENT_CHAMPION',
    'CONSISTENCY_MASTER'
  ], required: true },
  badgeName: { type: String, required: true },
  badgeDescription: { type: String, required: true },
  badgeIcon: { type: String, default: '🏆' },
  awardedAt: { type: Date, default: Date.now },
  academicYear: { type: String, trim: true, default: '' },
}, { timestamps: true });

badgeSchema.index({ studentId: 1, badgeType: 1 });
badgeSchema.index({ studentId: 1, awardedAt: -1 });

module.exports = mongoose.model('Badge', badgeSchema);
