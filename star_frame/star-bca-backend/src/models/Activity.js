const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  points: { type: Number, required: true },
}, { _id: false });

const activitySchema = new mongoose.Schema({
  activityName: { type: String, required: true, unique: true, trim: true },
  vertical: { type: String, required: true, trim: true, default: 'Vertical 1 - Academic Performance' },
  maximumPoints: { type: Number, required: true, default: 100 },
  description: { type: String, trim: true },
  levels: { type: [levelSchema], default: [] },
  deadline: { type: Date, default: null },
  important: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
