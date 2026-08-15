const {
  exportStudentsToCSV,
  exportSubmissionsToExcel,
  generateDepartmentReportPDF,
  bulkImportStudents,
  bulkUpdateSubmissionStatus,
  bulkAssignTeachers
} = require('../services/exportService');
const { Submission } = require('../models');

const handleError = (res, error, statusCode = 500) => {
  console.error('Error:', error);
  res.status(statusCode).json({
    success: false,
    message: error.message || 'An error occurred',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

/**
 * Export students to CSV
 */
async function exportStudentsCSV(req, res) {
  try {
    const { departmentId, academicYear } = req.query;
    
    const csvData = await exportStudentsToCSV(departmentId, academicYear);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="students_${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Export submissions to Excel
 */
async function exportSubmissionsExcel(req, res) {
  try {
    const { status, departmentId, academicYear } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (academicYear) filter.academicYear = academicYear;
    
    const buffer = await exportSubmissionsToExcel(filter);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="submissions_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Generate department report PDF
 */
async function generateDepartmentReport(req, res) {
  try {
    const { departmentId, academicYear } = req.query;
    
    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'departmentId is required'
      });
    }
    
    const pdfBuffer = await generateDepartmentReportPDF(departmentId, academicYear);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="department_report_${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Bulk import students from CSV
 */
async function bulkImportStudentsCSV(req, res) {
  try {
    const { csvData, departmentId, academicYear } = req.body;

    if (!csvData) {
      return res.status(400).json({
        success: false,
        message: 'csvData is required'
      });
    }

    // Faculty can only import into their own department
    const effectiveDepartmentId = req.user?.role === 'faculty'
      ? (req.user.departmentId || departmentId)
      : departmentId;

    if (!effectiveDepartmentId) {
      return res.status(400).json({
        success: false,
        message: 'departmentId is required'
      });
    }

    const results = await bulkImportStudents(csvData, effectiveDepartmentId, academicYear);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Bulk update submission status
 */
async function bulkUpdateSubmissions(req, res) {
  try {
    const { submissionIds, status, remarks } = req.body;
    
    if (!submissionIds || !Array.isArray(submissionIds) || !status) {
      return res.status(400).json({
        success: false,
        message: 'submissionIds (array) and status are required'
      });
    }
    
    const result = await bulkUpdateSubmissionStatus(submissionIds, status, remarks);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Bulk assign teachers to students
 */
async function bulkAssignTeachersToStudents(req, res) {
  try {
    const { assignments } = req.body;
    
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'assignments (array) is required'
      });
    }
    
    const result = await bulkAssignTeachers(assignments);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = {
  exportStudentsCSV,
  exportSubmissionsExcel,
  generateDepartmentReport,
  bulkImportStudentsCSV,
  bulkUpdateSubmissions,
  bulkAssignTeachersToStudents
};
