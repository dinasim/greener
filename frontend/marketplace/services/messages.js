// Set your Azure Functions base URL here.
// This URL should point to your deployed Azure Functions App endpoint.
const baseUrl = 'https://usersfunctions.azurewebsites.net/api'; // ⚠️ Replace with your Azure URL if different

// Create a new chat room with the given receiver ID and initial message
export async function createChatRoom(receiver, message) {
  try {
    const res = await fetch(`${baseUrl}/messages/createChatRoom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${yourFirebaseIdToken}`  <-- Add if Azure requires auth
      },
      body: JSON.stringify({ receiver, message }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error creating chat room:', err);
    throw err;
  }
}

// Fetch all chat conversations for the authenticated user
export async function getUserConversations() {
  try {
    const res = await fetch(`${baseUrl}/messages/getUserConversations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${yourFirebaseIdToken}`  <-- Add if needed
      },
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching conversations:', err);
    throw err;
  }
}

// Send a new message to an existing chat room by ID
export async function sendMessage(chatId, message) {
  try {
    const res = await fetch(`${baseUrl}/messages/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${yourFirebaseIdToken}`  <-- Add if needed
      },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error sending message:', err);
    throw err;
  }
}
