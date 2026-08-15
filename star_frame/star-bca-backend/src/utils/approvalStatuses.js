// Statuses that count as "earned points / approved" for students.
// FacultyApproved counts too, so a student's points reflect a faculty
// approval immediately (HOD approval is the final confirmation step).
const EARNED_STATUSES = ['FacultyApproved', 'Approved'];

module.exports = { EARNED_STATUSES };