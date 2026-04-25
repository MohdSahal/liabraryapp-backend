const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT env variable:", error);
    }
} else {
    try {
        serviceAccount = require('../../serviceAccountKey.json');
    } catch (error) {
        console.warn("No serviceAccountKey.json found and FIREBASE_SERVICE_ACCOUNT not set.");
    }
}

const config = {
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
};

if (serviceAccount) {
    config.credential = admin.credential.cert(serviceAccount);
}

admin.initializeApp(config);

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { db, auth, storage, admin };
