const admin = require("firebase-admin");

const USER_CONFIGS = {
  "chengfai@hotmail.com": {
    projectId: process.env.FAI_PROJECT_ID || "financialtrackerapp-453413",
    appName: "fai",
  },
  "engseeaw@gmail.com": {
    projectId: process.env.SEE_PROJECT_ID || "see-financialtrackerapp",
    appName: "see",
  },
};

// Lazy-initialize Firebase Admin apps (one per user/project)
const apps = {};

function getApp(email) {
  if (apps[email]) return apps[email];

  const config = USER_CONFIGS[email];
  if (!config) throw new Error(`No Firebase project configured for user: ${email}`);

  try {
    apps[email] = admin.initializeApp(
      {
        credential: admin.credential.applicationDefault(),
        projectId: config.projectId,
      },
      config.appName
    );
  } catch (err) {
    // App may already be initialized (e.g., hot reload)
    if (err.code === 'app/duplicate-app') {
      apps[email] = admin.app(config.appName);
    } else {
      throw err;
    }
  }

  return apps[email];
}

/**
 * Returns the Firestore client for the given user email.
 */
function getFirestoreForUser(email) {
  const app = getApp(email);
  return app.firestore();
}

module.exports = { USER_CONFIGS, getFirestoreForUser };
