const { admin, db } = require('./src/config/firebase');

async function wipeData() {
    console.log("Starting data wipe...");
    const collections = ['books', 'users', 'transactions', 'organizations', 'staff', 'invites'];

    for (const collectionName of collections) {
        console.log(`Deleting documents in collection: ${collectionName}`);
        const snapshot = await db.collection(collectionName).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleared ${collectionName}`);
    }

    console.log("Deleting Auth users...");
    const listUsersResult = await admin.auth().listUsers();
    const uids = listUsersResult.users.map(userRecord => userRecord.uid);
    if (uids.length > 0) {
        await admin.auth().deleteUsers(uids);
        console.log(`Deleted ${uids.length} auth users.`);
    } else {
        console.log("No auth users found.");
    }

    console.log("Data wipe complete.");
    process.exit();
}

wipeData();
