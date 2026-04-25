const { db } = require('./src/config/firebase');

async function checkBooks() {
    try {
        const snapshot = await db.collection('books').get();
        if (snapshot.empty) {
            console.log('No books found.');
            return;
        }

        snapshot.forEach(doc => {
            const book = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`Name: ${book.name}`);
            console.log(`Image URL: ${book.imageUrl}`);
            console.log('-------------------');
        });
    } catch (error) {
        console.error('Error fetching books:', error);
    }
}

checkBooks();
