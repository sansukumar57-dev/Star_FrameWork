const assert = require('assert');
const test = require('node:test');
const { validateDepartmentPayload } = require('../src/utils/deanScope');

test('dean department validation blocks cross-school assignment', () => {
  const req = { user: { accountType: 'dean', schoolId: 'school-1' } };
  const result = validateDepartmentPayload({ name: 'Computer Science', code: 'CS', schoolId: 'school-2' }, req);

  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('their own school')));
});

test('dean department validation accepts matching school assignment', () => {
  const req = { user: { accountType: 'dean', schoolId: 'school-1' } };
  const result = validateDepartmentPayload({ name: 'Computer Science', code: 'CS', schoolId: 'school-1' }, req);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.normalized.code, 'CS');
});
