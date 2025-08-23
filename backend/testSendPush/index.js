// OBSOLETE: Replaced by Python implementation (__init__.py). Safe to delete.

// const { fetchValidTokens, sendChatMessageNotificationsCombined } = require('../shared/notificationSender');

// module.exports = async function (context, req) {
//   try {
//     const {
//       userIds = [],          // array of target userIds/emails
//       title = 'Test Notification',
//       body = 'This is a test push',
//       data = { type: 'test_push' }
//     } = req.body || {};

//     if (!Array.isArray(userIds) || userIds.length === 0) {
//       context.res = { status: 400, body: { error: 'userIds (array) required' } };
//       return;
//     }

//     const tokens = await fetchValidTokens(userIds);
//     if (!tokens.length) {
//       context.res = { status: 200, body: { message: 'No valid tokens for provided userIds', tokens: 0 } };
//       return;
//     }

//     const result = await sendChatMessageNotificationsCombined({
//       tokens,
//       title,
//       body,
//       data,
//       log: context.log
//     });

//     context.res = { status: 200, body: { ok: true, targetUsers: userIds.length, tokens: tokens.length, result } };
//   } catch (e) {
//     context.log('testSendPush error', e);
//     context.res = { status: 500, body: { error: 'internal' } };
//   }
// };
