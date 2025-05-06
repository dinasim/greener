// frontend/services/messages.js
const baseUrl = 'https://usersfunctions.azurewebsites.net/api'; // Azure endpoint

export async function createChatRoom(receiver, message) {
  const res = await fetch(`${baseUrl}/messages/createChatRoom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ receiver, message }),
  });
  return res.json();
}

export async function getUserConversations() {
  const res = await fetch(`${baseUrl}/messages/getUserConversations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function sendMessage(chatId, message) {
  const res = await fetch(`${baseUrl}/messages/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatId, message }),
  });
  return res.json();
}
