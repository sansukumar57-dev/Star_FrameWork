const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { User, Submission, Department } = require('../models');

// Export students to CSV
async function exportStudentsToCSV(departmentId = null, academicYear = '') {
  try {
    const query = { role: 'student' };
    if (departmentId) query.departmentId = departmentId;
    if (academicYear) query.academicYear = academicYear;

    const students = await User.find(query)
      .populate('departmentId', 'name')
      .select('name email regNo batch year department academicYear totalPoints approvedSubmissions');

    const studentData = students.map(s => ({
      'Register Number': s.regNo || s.registerNumber || '',
      'Name': s.name,
      'Email': s.email || '',
      'Batch': s.batch || '',
      'Year': s.year || '',
      'Department': s.department || s.departmentId?.name || '',
      'Academic Year': s.academicYear || '',
      'Total Points': s.totalPoints || 0,
      'Approved Submissions': s.approvedSubmissions || 0
    }));

    const parser = new Parser();
    return parser.parse(studentData);
  } catch (error) {
    console.error('Error exporting students to CSV:', error);
    throw error;
  }
}

// Export submissions to Excel with formatting
async function exportSubmissionsToExcel(filter = {}) {
  try {
    const submissions = await Submission.find(filter)
      .populate('studentId', 'name regNo email')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Submissions');

    // Define columns
    worksheet.columns = [
      { header: 'Student Name', key: 'studentName', width: 20 },
      { header: 'Register No', key: 'registerNo', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Activity', key: 'activity', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Suggested Points', key: 'suggestedPoints', width: 12 },
      { header: 'Awarded Points', key: 'pointsAwarded', width: 12 },
      { header: 'Submitted At', key: 'submittedAt', width: 15 },
      { header: 'Verified At', key: 'verifiedAt', width: 15 },
      { header: 'Remarks', key: 'remarks', width: 30 }
    ];

    // Add rows
    submissions.forEach(sub => {
      worksheet.addRow({
        studentName: sub.studentId?.name || 'N/A',
        registerNo: sub.studentId?.regNo || '',
        email: sub.studentId?.email || '',
        activity: sub.activityId?.activityName || 'N/A',
        status: sub.status,
        suggestedPoints: sub.suggestedPoints || 0,
        pointsAwarded: sub.pointsAwarded || 0,
        submittedAt: sub.submittedAt?.toLocaleDateString() || '',
        verifiedAt: sub.verifiedAt?.toLocaleDateString() || '',
        remarks: sub.teacherRemarks || ''
      });
    });

    // Format header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    };

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('Error exporting submissions to Excel:', error);
    throw error;
  }
}

// Generate department report PDF
async function generateDepartmentReportPDF(departmentId, academicYear = '') {
  try {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    const department = await Department.findById(departmentId);
    const students = await User.find({
      role: 'student',
      departmentId,
      academicYear: academicYear || undefined
    }).sort({ totalPoints: -1 });

    const submissions = await Submission.find({
      academicYear: academicYear || undefined
    }).populate('studentId').populate('activityId');

    const deptSubmissions = submissions.filter(s => 
      students.some(st => st._id.equals(s.studentId._id))
    );

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Department Report', 50, 50);
    doc.fontSize(12).font('Helvetica').text(`Department: ${department?.name || 'N/A'}`, 50, 80);
    doc.fontSize(10).text(`Academic Year: ${academicYear || 'N/A'}`, 50, 100);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 120);

    // Statistics
    doc.moveTo(50, 140).lineTo(550, 140).stroke();
    doc.fontSize(12).font('Helvetica-Bold').text('Department Statistics', 50, 155);

    const stats = {
      'Total Students': students.length,
      'Total Submissions': deptSubmissions.length,
      'Approved Submissions': deptSubmissions.filter(s => ['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status)).length,
      'Average Points': (deptSubmissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0) / students.length || 0).toFixed(2),
      'Top Student': students[0]?.name || 'N/A'
    };

    let yPos = 180;
    Object.entries(stats).forEach(([key, value]) => {
      doc.fontSize(10).text(`${key}: ${value}`, 50, yPos);
      yPos += 20;
    });

    // Top performers table
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 20;
    doc.fontSize(12).font('Helvetica-Bold').text('Top Performers', 50, yPos);
    yPos += 20;

    const top10 = students.slice(0, 10);
    top10.forEach((student, index) => {
      doc.fontSize(9).font('Helvetica')
        .text(`${index + 1}. ${student.name} - ${student.totalPoints} points`, 50, yPos);
      yPos += 15;
    });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating department report:', error);
    throw error;
  }
}

// Bulk import students from CSV data
async function bulkImportStudents(csvData, departmentId, academicYear = '') {
  try {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Parse CSV rows
    const rows = csvData.trim().split('\n').slice(1); // Skip header

    for (let i = 0; i < rows.length; i++) {
      try {
        const [name, email, regNo, batch, year] = rows[i].split(',').map(v => v.trim());

        if (!name || !email || !regNo) {
          results.errors.push({ row: i + 2, error: 'Missing required fields: name, email, regNo' });
          results.failed++;
          continue;
        }

        // Check for duplicate
        const existing = await User.findOne({ regNo });
        if (existing) {
          results.errors.push({ row: i + 2, error: `Student with register number ${regNo} already exists` });
          results.failed++;
          continue;
        }

        // Create new student
        await User.create({
          name,
          email,
          regNo,
          registerNumber: regNo,
          batch,
          year,
          role: 'student',
          password: 'temp_password_' + Date.now(),
          departmentId,
          academicYear: academicYear || new Date().getFullYear().toString()
        });

        results.successful++;
      } catch (error) {
        results.errors.push({ row: i + 2, error: error.message });
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error('Error in bulk import:', error);
    throw error;
  }
}

// Bulk update submission status
async function bulkUpdateSubmissionStatus(submissionIds, status, remarks = '') {
  try {
    const result = await Submission.updateMany(
      { _id: { $in: submissionIds } },
      {
        status,
        teacherRemarks: remarks,
        verifiedAt: new Date()
      }
    );

    return {
      modified: result.modifiedCount,
      matched: result.matchedCount
    };
  } catch (error) {
    console.error('Error in bulk update:', error);
    throw error;
  }
}

// Bulk assign teachers to students
async function bulkAssignTeachers(assignments) {
  try {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < assignments.length; i++) {
      try {
        const { studentId, teacherId } = assignments[i];

        const student = await User.findById(studentId);
        const teacher = await User.findById(teacherId);

        if (!student || !teacher) {
          results.errors.push({ index: i, error: 'Invalid student or teacher ID' });
          results.failed++;
          continue;
        }

        student.assignedTeacher = teacherId;
        student.assignedFacultyId = teacherId;
        await student.save();

        results.successful++;
      } catch (error) {
        results.errors.push({ index: i, error: error.message });
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error('Error in bulk assign:', error);
    throw error;
  }
}

module.exports = {
  exportStudentsToCSV,
  exportSubmissionsToExcel,
  generateDepartmentReportPDF,
  bulkImportStudents,
  bulkUpdateSubmissionStatus,
  bulkAssignTeachers
};
