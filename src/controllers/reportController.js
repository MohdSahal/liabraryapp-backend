const { db } = require('../config/firebase');

const transactionsCollection = db.collection('transactions');

// Helper to clean up data for reports
const sanitizeTransactionData = (data) => {
    return data.map(t => {
        // Create an ordered object: Names first, then dates, then status
        const { bookId, userId, ...rest } = t;
        return {
            bookName: rest.bookName,
            userName: rest.userName,
            issueDate: rest.issueDate,
            expectedReturnDate: rest.expectedReturnDate,
            status: rest.status,
            actualReturnDate: rest.actualReturnDate
        };
    });
};

// Helper to adjust local date string (YYYY-MM-DD) to UTC boundary for IST (+5:30)
const getISTBoundary = (dateStr, isEnd = false) => {
    if (!dateStr) return null;
    // For start of day: YYYY-MM-DDT00:00:00.000+05:30
    // For end of day: YYYY-MM-DDT23:59:59.999+05:30
    const time = isEnd ? '23:59:59.999+05:30' : '00:00:00.000+05:30';
    return new Date(`${dateStr}T${time}`).toISOString();
};

exports.getIssuedBooksReport = async (req, res) => {
    try {
        const { from, to, bookId, userId } = req.query;
        let query = transactionsCollection.where('organizationId', '==', req.user.organizationId);

        if (from) query = query.where('issueDate', '>=', getISTBoundary(from));
        if (to) query = query.where('issueDate', '<=', getISTBoundary(to, true));
        if (bookId) query = query.where('bookId', '==', bookId);
        if (userId) query = query.where('userId', '==', userId);

        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => doc.data());
        res.json(sanitizeTransactionData(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReturnedBooksReport = async (req, res) => {
    try {
        const { from, to, bookId, userId } = req.query;
        let query = transactionsCollection.where('organizationId', '==', req.user.organizationId).where('status', '==', 'Returned');

        if (from) query = query.where('actualReturnDate', '>=', getISTBoundary(from));
        if (to) query = query.where('actualReturnDate', '<=', getISTBoundary(to, true));
        if (bookId) query = query.where('bookId', '==', bookId);
        if (userId) query = query.where('userId', '==', userId);

        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => doc.data());
        res.json(sanitizeTransactionData(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOverdueReport = async (req, res) => {
    try {
        const { bookId, userId } = req.query;
        const today = new Date().toISOString();
        let query = transactionsCollection
            .where('organizationId', '==', req.user.organizationId)
            .where('status', '==', 'Issued')
            .where('expectedReturnDate', '<', today);

        if (bookId) query = query.where('bookId', '==', bookId);
        if (userId) query = query.where('userId', '==', userId);

        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => doc.data());
        res.json(sanitizeTransactionData(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTopBooks = async (req, res) => {
    try {
        const snapshot = await transactionsCollection.where('organizationId', '==', req.user.organizationId).get();
        const transactions = snapshot.docs.map(doc => doc.data());

        const bookCounts = {};
        transactions.forEach(t => {
            bookCounts[t.bookName] = (bookCounts[t.bookName] || 0) + 1;
        });

        const sortedBooks = Object.entries(bookCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        res.json(sortedBooks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
