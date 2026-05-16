const admin = require('firebase-admin');

let appInitialized = false;

function initializeFirebaseAdmin() {
  if (appInitialized) return;

  let FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  let FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
  let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    try {
      const serviceAccount = require('./aichatbot-b4bf4-firebase-adminsdk-fbsvc-3908efb57e.json');
      FIREBASE_PROJECT_ID = serviceAccount.project_id;
      FIREBASE_CLIENT_EMAIL = serviceAccount.client_email;
      FIREBASE_PRIVATE_KEY = serviceAccount.private_key;
    } catch (e) {
      console.warn('Firebase Admin env vars are not fully set and service account json not found. Skipping admin init.');
      return;
    }
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    appInitialized = true;
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
  }
}

initializeFirebaseAdmin();
const db = admin.firestore();

async function authenticateFirebase(req, res, next) {
  try {
    initializeFirebaseAdmin();
    if (!appInitialized) {
      return res.status(500).json({ error: 'Auth not configured on server' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // attach user info
    return next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  authenticateFirebase,
  db
};


