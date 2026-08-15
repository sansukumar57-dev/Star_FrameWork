const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  accountType: { type: String, enum: ['dean', 'hod'], default: null },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  school: { type: String, trim: true, default: '' },
  department: { type: String, trim: true, default: '' },
  registerNo: { type: String, trim: true, sparse: true, unique: true },
  registerNumber: { type: String, trim: true, sparse: true, unique: true },
  regNo: { type: String, trim: true, sparse: true, unique: true },
  year: { type: String, trim: true, default: '' },
  batch: { type: String, trim: true, default: '' },
  section: { type: String, trim: true, default: '' },
  phoneNumber: { type: String, trim: true, default: '' },
  dob: { type: String, trim: true, default: '' },
  assignedTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recommendedSchool: { type: String, trim: true, default: '' },
  recommendedDepartment: { type: String, trim: true, default: '' },
  recommendedFaculty: { type: String, trim: true, default: '' },
  assignedYear: { type: String, trim: true, default: '' },
  yearAssigned: { type: String, trim: true, default: '' },
  semesterBatch: { type: String, trim: true, default: '' },
  academicYear: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  semesterLocked: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ role: 1, accountType: 1, schoolId: 1, departmentId: 1 });
userSchema.index({ assignedTeacher: 1 });
userSchema.index({ assignedFacultyId: 1 });

userSchema.pre('save', async function normalizeAndHashPassword() {
  if (this.registerNo && !this.registerNumber) this.registerNumber = this.registerNo;
  if (this.registerNo && !this.regNo) this.regNo = this.registerNo;
  if (this.assignedTeacher && !this.assignedFacultyId) this.assignedFacultyId = this.assignedTeacher;
  if (this.assignedFacultyId && !this.assignedTeacher) this.assignedTeacher = this.assignedFacultyId;
  if (this.role === 'student' && !this.batch && this.semesterBatch) this.batch = this.semesterBatch;
  if (this.role === 'student' && !this.year && (this.semesterBatch || this.batch)) this.year = this.semesterBatch || this.batch;

  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
