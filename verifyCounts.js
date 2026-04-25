const { db } = require('./src/config/firebase');

async function verifyCounts() {
    console.log('--- Dashboard Data Verification ---');

    const collections = ['books', 'users', 'transactions'];
    for (const coll of collections) {
        try {
            const snap = await db.collection(coll).get();
            console.log(`- Collection '${coll}' size: ${snap.size}`);
        } catch (e) {
            console.error(`- Collection '${coll}' failed:`, e.message);
        }
    }

    try {
        const today = new Date().toISOString();
        const overdue = await db.collection('transactions')
            .where('status', '==', 'Issued')
            .where('expectedReturnDate', '<', today)
            .get();
        console.log(`- Overdue query size: ${overdue.size}`);
    } catch (error) {
        console.error('- Overdue query failed (Likely missing index):', error.message);
    }

    try {
        const booksSnap = await db.collection('books').get();
        const books = booksSnap.docs.map(doc => doc.data());
        console.log(`- Total Books: ${books.length}`);
        console.log(`- Available Books: ${books.filter(b => b.isAvailable).length}`);

        const transactionsSnap = await db.collection('transactions').get();
        const transactions = transactionsSnap.docs.map(doc => doc.data());
        console.log(`- Total Transactions: ${transactions.length}`);

        // Top Books
        const bCounts = {};
        transactions.forEach(t => bCounts[t.bookName] = (bCounts[t.bookName] || 0) + 1);
        const sortedB = Object.entries(bCounts).sort((a, b) => b[1] - a[1]);
        console.log(`- Top Book: ${sortedB[0] ? sortedB[0][0] + ' (' + sortedB[0][1] + ')' : 'N/A'}`);

        // Top Users
        const uCounts = {};
        transactions.forEach(t => uCounts[t.userName] = (uCounts[t.userName] || 0) + 1);
        const sortedU = Object.entries(uCounts).sort((a, b) => b[1] - a[1]);
        console.log(`- Top User: ${sortedU[0] ? sortedU[0][0] + ' (' + sortedU[0][1] + ')' : 'N/A'}`);
    } catch (e) {
        console.error('- Comprehensive check failed:', e.message);
    }

    console.log('-----------------------------------');
    process.exit(0);
}

verifyCounts();
