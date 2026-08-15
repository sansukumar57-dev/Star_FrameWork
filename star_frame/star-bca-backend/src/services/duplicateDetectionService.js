const { Jimp, compareHashes } = require('jimp');
const Submission = require('../models/Submission');

// 0 = identical, 1 = completely different. Same certificate scans/re-encodes
// land well under this threshold.
const DUPLICATE_THRESHOLD = Number(process.env.DUPLICATE_THRESHOLD || 0.15);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function isImageContentType(contentType) {
  return String(contentType || '').toLowerCase().startsWith('image/');
}

function hammingSimilarity(hashA, hashB) {
  if (!hashA || !hashB) return 1;
  try {
    return compareHashes(hashA, hashB);
  } catch (error) {
    return 1;
  }
}

// 16-cell average-color signature so that structurally similar but differently
// colored certificates are not false-flagged as duplicates.
function computeColorSignature(image) {
  const resized = image.clone().resize({ w: 4, h: 4 });
  const data = resized.bitmap.data;
  let hex = '';
  for (let i = 0; i < data.length; i += 4) {
    hex += [data[i], data[i + 1], data[i + 2]]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }
  return hex;
}

function colorDistance(sigA, sigB) {
  if (!sigA || !sigB || sigA.length !== sigB.length) return 1;
  let totalDiff = 0;
  let pairs = 0;
  for (let i = 0; i < sigA.length; i += 2) {
    totalDiff += Math.abs(parseInt(sigA.slice(i, i + 2), 16) - parseInt(sigB.slice(i, i + 2), 16));
    pairs += 1;
  }
  return totalDiff / pairs / 255;
}

async function computeImageHash(buffer) {
  if (!buffer || !buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  try {
    const image = await Jimp.read(buffer);
    const structural = await image.hash();
    return { structural, color: computeColorSignature(image) };
  } catch (error) {
    console.error('[duplicate] failed to hash image:', error.message);
    return null;
  }
}

function compareHashes2(a, b) {
  const structuralDist = hammingSimilarity(a.structural, b.structural);
  const colorDist = colorDistance(a.color, b.color);
  return Math.max(structuralDist, colorDist);
}

/**
 * Compare an uploaded certificate image against certificates already submitted
 * for the same activity by OTHER students.
 */
async function checkForDuplicate({ studentId, activityId, buffer, hash }) {
  const computedHash = hash || (await computeImageHash(buffer));
  if (!computedHash) return { checked: false, isDuplicate: false, hash: null };

  const candidates = await Submission.find({
    activityId,
    studentId: { $ne: studentId },
    certificateImageHash: { $ne: '', $exists: true },
  })
    .select('studentId certificateImageHash certificateColorHash status')
    .lean();

  let best = null;
  let bestScore = 1;
  for (const candidate of candidates) {
    const score = compareHashes2(hash, {
      structural: candidate.certificateImageHash,
      color: candidate.certificateColorHash,
    });
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const isDuplicate = Boolean(best) && bestScore <= DUPLICATE_THRESHOLD;
  return {
    checked: true,
    isDuplicate,
    score: Math.round(bestScore * 100) / 100,
    hash,
    matchedSubmissionId: isDuplicate ? best._id : null,
    matchedStudentId: isDuplicate ? best.studentId : null,
  };
}

async function listFlaggedDuplicates({ limit = 50 } = {}) {
  return Submission.find({ duplicateOf: { $ne: null } })
    .populate('studentId', 'name registerNo department')
    .populate('duplicateOf', 'studentId')
    .populate('activityId', 'activityName')
    .sort({ submittedAt: -1 })
    .limit(Number(limit) || 50)
    .lean();
}

module.exports = {
  DUPLICATE_THRESHOLD,
  computeImageHash,
  hammingSimilarity,
  colorDistance,
  compareHashes2,
  isImageContentType,
  checkForDuplicate,
  listFlaggedDuplicates,
};