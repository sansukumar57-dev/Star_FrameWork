const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { sendSuccess, sendError } = require('../utils/response');
const { semanticSearch } = require('../services/semanticSearchService');

const router = express.Router();

router.use(authMiddleware);

router.post('/semantic', async (req, res, next) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) return sendError(res, 400, 'query is required');
    const result = await semanticSearch({ query });
    return sendSuccess(res, 200, 'Search complete', result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;