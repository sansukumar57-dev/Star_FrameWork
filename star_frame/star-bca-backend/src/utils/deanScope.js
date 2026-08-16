const normalizeDepartmentPayload = (payload = {}) => ({
  name: `${payload.name || ''}`.trim(),
  code: `${payload.code || ''}`.trim().toUpperCase(),
  schoolId: `${payload.schoolId || ''}`.trim(),
  status: payload.status || 'Active',
});

const validateDepartmentPayload = (payload, req) => {
  const normalized = normalizeDepartmentPayload(payload);
  const errors = [];

  if (!normalized.name) {
    errors.push('Department name is required');
  }

  if (!normalized.code) {
    errors.push('Department code is required');
  }

  if (!normalized.schoolId) {
    errors.push('School is required');
  }

  return { ok: errors.length === 0, errors, normalized };
};

module.exports = {
  normalizeDepartmentPayload,
  validateDepartmentPayload,
};
