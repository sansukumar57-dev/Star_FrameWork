const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActivityDate: { type: Date, default: null },
  streakStartDate: { type: Date, default: null },
  totalActivityDays: { type: Number, default: 0 },
  academicYear: { type: String, trim: true, default: '' },
}, { timestamps: true });

streakSchema.index({ studentId: 1, academicYear: 1 });

module.exports = mongoose.model('UserStreak', streakSchema);
