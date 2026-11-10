const { buildRobokassaUrl, verifyRobokassaSignature } = require('../robokassa');
async function createPayment({ invoiceId, userId, targetUserId, type, amount, description }) {
  return buildRobokassaUrl(userId, targetUserId, invoiceId, type, amount, description);
}
function verifyWebhook(payload) { return verifyRobokassaSignature(payload); }
module.exports = { createPayment, verifyWebhook };
