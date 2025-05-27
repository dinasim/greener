const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });

const webToken = "d-tUDinGWEqli28PAbx8LC:APA91bFv1sYAJ6eadOMLtVh0GslWrKnRa9HirT-wTtYs26jJoPLOeqc_SF85TGBTn5-hahzufQ4xZ3M4V5sMzc9jv62cLTBp1hmua6_Qh6dVHNvKuu6lyqY"; // Paste your token from the browser

const message = {
  notification: {
    title: "hello world",
    body: "Push notification to web!",
  },
  token: webToken,
};

setInterval(() => {
  admin.messaging().send(message)
    .then(res => console.log("Sent!", res))
    .catch(err => console.error("Error sending:", err));
}, 10000); // Every 10 seconds for demo
