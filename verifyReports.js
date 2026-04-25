const { db } = require('./src/config/firebase');

async function verifyReports() {
    console.log('--- Starting Reports Logic Verification ---');

    const transactionsCollection = db.collection('transactions');
    const today = new Date().toISOString();
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();

    try {
        const getISTBoundary = (dateStr, isEnd = false) => {
            const time = isEnd ? '23:59:59.999+05:30' : '00:00:00.000+05:30';
            return new Date(`${dateStr}T${time}`).toISOString();
        };

        const feb10End = getISTBoundary('2026-02-10', true);
        const testRecordUTC = '2026-02-10T20:07:11.611Z'; // Feb 11 01:37 AM IST

        console.log('\n--- IST Boundary Logic Verification ---');
        console.log(`Filter [To Feb 10 IST] UTC boundary: ${feb10End}`);
        console.log(`Test Record (Feb 11 IST):          ${testRecordUTC}`);

        if (testRecordUTC <= feb10End) {
            console.log('❌ Error: Record from Feb 11 IST is INCLUDED in Feb 10 filter!');
        } else {
            console.log('✅ Success: Record from Feb 11 IST is correctly EXCLUDED from Feb 10 filter.');
        }

        const snapDirect = await transactionsCollection
            .where('issueDate', '<=', feb10End)
            .get();

        const foundBuggyRecord = snapDirect.docs.some(doc => doc.data().issueDate === testRecordUTC);
        if (foundBuggyRecord) {
            console.log('❌ Error: The record was found in Firestore filtered results.');
        } else {
            console.log('✅ Correct: The record was filtered out of Firestore results.');
        }

        // 4. Top Books Data
        console.log('\nChecking [Top Books] Data...');
        const allSnap = await transactionsCollection.get();
        const bookCounts = {};
        allSnap.docs.forEach(doc => {
            const t = doc.data();
            bookCounts[t.bookName] = (bookCounts[t.bookName] || 0) + 1;
        });
        const topBooks = Object.entries(bookCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        console.log(`✅ Top Book: ${topBooks[0] ? topBooks[0][0] + ' (' + topBooks[0][1] + ' times)' : 'N/A'}`);

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }

    console.log('\n--- Verification Complete ---');
    process.exit(0);
}

verifyReports();
