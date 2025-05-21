self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Notification", body: "You have a new message!" };
  }

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon.jpeg', // Make sure this exists in your public folder or remove this line
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // Opens your web app homepage; change if you want
  );
});
