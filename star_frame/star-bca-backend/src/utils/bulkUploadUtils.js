const normalizeHeader = (header) => String(header || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeBulkRow = (row = {}) => Object.entries(row || {}).reduce((accumulator, [key, value]) => {
  accumulator[normalizeHeader(key)] = value;
  return accumulator;
}, {});

const getValue = (row, candidates = []) => {
  for (const candidate of candidates) {
    const value = row?.[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const isEmptyRow = (row = {}) => {
  return Object.values(row || {}).every((value) => {
    if (value === undefined || value === null) return true;
    return String(value).trim() === '';
  });
};

const getRequiredValidationErrors = (row = {}) => {
  const normalizedRow = normalizeBulkRow(row);
  const name = getValue(normalizedRow, ['name', 'full name', 'fullname']);
  const registerNumber = getValue(normalizedRow, ['register number', 'register no', 'reg no', 'regno', 'reg number', 'registernumber', 'student id', 'studentid']);
  const email = getValue(normalizedRow, ['email', 'email id', 'emailaddress']);
  const errors = [];

  if (!String(name).trim()) errors.push('Name is required');
  if (!String(registerNumber).trim()) errors.push('Register number is required');
  if (!String(email).trim()) errors.push('Email is required');

  return errors;
};

module.exports = {
  normalizeBulkRow,
  getValue,
  isEmptyRow,
  getRequiredValidationErrors,
};
