const admin = require('firebase-admin');

// When running on Cloud Run in the same GCP project as Firebase,
// Application Default Credentials are used automatically.
// No service account key file needed.
admin.initializeApp({
  projectId: process.env.GCP_PROJECT_ID,
});

const db = admin.firestore();

module.exports = { admin, db };
