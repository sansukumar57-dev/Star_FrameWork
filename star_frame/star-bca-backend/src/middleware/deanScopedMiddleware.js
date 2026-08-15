const { sendError } = require('../utils/response');

const deanScopedMiddleware = (req, res, next) => {
  if (!req.user) return sendError(res, 401, 'Authentication required');
  if (req.user.accountType !== 'dean') return next();

  const method = req.method.toUpperCase();
  const pathname = req.path || '';

  const allowed =
    (method === 'GET' && (
      pathname === '/analytics' ||
      pathname === '/analytics/export' ||
      pathname === '/lookups' ||
      pathname === '/activities' ||
      pathname === '/audit-logs' ||
      pathname === '/academic-year' ||
      pathname === '/bulk-upload/template' ||
      pathname === '/users' ||
      pathname.startsWith('/users/')
    )) ||
    (method === 'POST' && (pathname === '/departments' || pathname === '/users' || pathname === '/users/bulk-upload'));

  if (!allowed) {
    return sendError(res, 403, 'Dean accounts can only manage departments and HODs');
  }

  next();
};

module.exports = deanScopedMiddleware;
