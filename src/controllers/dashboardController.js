const { db } = require('../config/firebase');

exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date().toISOString();

        const [booksRes, usersRes, transactionsRes, overdueRes] = await Promise.allSettled([
            db.collection('books').get(),
            db.collection('users').get(),
            db.collection('transactions').get(),
            db.collection('transactions')
                .where('status', '==', 'Issued')
                .where('expectedReturnDate', '<', today)
                .get()
        ]);

        const books = booksRes.status === 'fulfilled' ? booksRes.value.docs.map(doc => doc.data()) : [];
        const totalBooks = books.length;
        const availableBooks = books.filter(b => b.isAvailable).length;

        const totalUsers = usersRes.status === 'fulfilled' ? usersRes.value.size : 0;

        const transactions = transactionsRes.status === 'fulfilled' ? transactionsRes.value.docs.map(doc => doc.data()) : [];
        const issuedBooks = transactions.filter(t => t.status === 'Issued').length;

        const overdueBooks = overdueRes.status === 'fulfilled' ? overdueRes.value.size : 0;

        // Analytics: Top Books
        const bookCounts = {};
        transactions.forEach(t => {
            bookCounts[t.bookName] = (bookCounts[t.bookName] || 0) + 1;
        });
        const topBooks = Object.entries(bookCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Analytics: Top Users
        const userCounts = {};
        transactions.forEach(t => {
            userCounts[t.userName] = (userCounts[t.userName] || 0) + 1;
        });
        const topUsers = Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Log errors locally for debugging
        if (overdueRes.status === 'rejected') {
            console.error('Overdue books query failed (likely missing index):', overdueRes.reason.message);
        }

        res.json({
            totalBooks,
            availableBooks,
            totalUsers,
            issuedBooks,
            overdueBooks,
            topBooks,
            topUsers,
            partialErrors: {
                overdue: overdueRes.status === 'rejected' ? overdueRes.reason.message : null
            }
        });
    } catch (error) {
        console.error('Fatal dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
