const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { sendError } = require('../utils/response');

const normalizeRole = (role) => (role === 'teacher' ? 'faculty' : role);

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const role = normalizeRole(decoded.role);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return sendError(res, 401, 'User not found');
    if (user.role !== role && !(decoded.role === 'teacher' && user.role === 'faculty')) {
      return sendError(res, 401, 'User not found');
    }

    req.user = { ...user.toObject(), id: user._id, role: user.role };
    next();
  } catch (error) {
    return sendError(res, 401, 'Invalid or expired token');
  }
};

module.exports = authMiddleware;
