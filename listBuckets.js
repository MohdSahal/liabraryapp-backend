const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function listBuckets() {
    try {
        console.log('Listing buckets...');
        const [buckets] = await admin.storage().bucket().storage.getBuckets();

        if (buckets.length === 0) {
            console.log('No buckets found.');
        } else {
            console.log('Buckets found:');
            buckets.forEach(bucket => {
                console.log(`- ${bucket.name}`);
            });
        }
    } catch (error) {
        console.error('Error listing buckets:', error.message);
    }
}

listBuckets();
