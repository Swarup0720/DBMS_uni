const dbmsService = require('../services/dbmsService');
const { asyncHandler } = require('../middleware/errorMiddleware');

const listConcepts = asyncHandler(async (_req, res) => {
  const concepts = dbmsService.listConcepts();
  res.json({ success: true, data: concepts });
});

const runConcept = asyncHandler(async (req, res) => {
  const result = await dbmsService.executeConcept(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = {
  listConcepts,
  runConcept
};

