const { fetchValidTokens, sendChatMessageNotificationsCombined } = require('../shared/notificationSender');

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

module.exports = async function (context, inputDocuments) {
  if (!Array.isArray(inputDocuments) || !inputDocuments.length) return;

  const log = context.log;
  let processedMessages = 0;
  let totalRecipients = 0;
  let totalSent = 0;
  let totalInvalid = 0;

  for (const doc of inputDocuments) {
    // Basic heuristic: only act on initial create (if _metadata or custom flag needed, adjust).
    processedMessages++;

    // Expected fields (adjust if schema differs).
    const {
      id: messageId,
      conversationId,
      senderId,
      participants,         // array of userIds (including sender)
      listingId,
      listingTitle,
      senderDisplayName,
      text
    } = doc;

    if (!participants || !Array.isArray(participants) || !senderId) {
      log('Skipping doc missing participants/senderId', doc.id);
      continue;
    }

    const recipientUserIds = participants.filter(p => p !== senderId);
    if (!recipientUserIds.length) continue;

    // Fetch tokens
    const tokens = await fetchValidTokens(recipientUserIds);
    if (!tokens.length) continue;

    const title = `New message about ${listingTitle || 'your listing'}`;
    const body = `${senderDisplayName || 'User'}: ${truncate(text || '', 80)}`;

    const data = {
      type: 'chat_message',
      conversationId: conversationId || '',
      listingId: listingId || '',
      senderId: senderId || '',
      messageId: messageId || ''
    };

    const { expoSent, expoInvalid, fcmSent, fcmInvalid } =
      await sendChatMessageNotificationsCombined({
        tokens,
        title,
        body,
        data,
        log
      });
    totalRecipients += tokens.length;
    totalSent += expoSent + fcmSent;
    totalInvalid += expoInvalid + fcmInvalid;
  }

  log(`chatMessageNotify processed=${processedMessages} recipients=${totalRecipients} sent=${totalSent} invalidTokensPruned=${totalInvalid}`);
};
