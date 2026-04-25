const { db, admin } = require('../config/firebase');

const transactionsCollection = db.collection('transactions');
const booksCollection = db.collection('books');
const usersCollection = db.collection('users');

exports.issueBook = async (req, res) => {
    try {
        const { bookId, userId, expectedReturnDate } = req.body;

        // Check if book exists and is available
        const bookDoc = await booksCollection.doc(bookId).get();
        if (!bookDoc.exists) return res.status(404).json({ error: 'Book not found' });
        if (!bookDoc.data().isAvailable) return res.status(400).json({ error: 'Book is currently not available' });

        // Check if user exists
        const userDoc = await usersCollection.doc(userId).get();
        if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

        // Create Transaction
        const issueDate = req.body.issueDate
            ? new Date(`${req.body.issueDate}T00:00:00.000+05:30`).toISOString()
            : new Date().toISOString();

        const newTransaction = {
            bookId,
            userId,
            userName: userDoc.data().name,
            bookName: bookDoc.data().name,
            issueDate,
            expectedReturnDate: expectedReturnDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Issued',
            actualReturnDate: null
        };

        // Run as transaction (atomic)
        await db.runTransaction(async (t) => {
            const transactionRef = transactionsCollection.doc();
            t.set(transactionRef, newTransaction);
            t.update(booksCollection.doc(bookId), { isAvailable: false });
        });

        res.status(201).json({ message: 'Book issued successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.returnBook = async (req, res) => {
    try {
        const { id } = req.params; // Transaction ID

        const transactionDoc = await transactionsCollection.doc(id).get();
        if (!transactionDoc.exists) return res.status(404).json({ error: 'Transaction not found' });

        const transactionData = transactionDoc.data();
        if (transactionData.status === 'Returned') return res.status(400).json({ error: 'Book already returned' });

        await db.runTransaction(async (t) => {
            t.update(transactionsCollection.doc(id), {
                status: 'Returned',
                actualReturnDate: new Date().toISOString()
            });
            t.update(booksCollection.doc(transactionData.bookId), { isAvailable: true });
        });

        res.status(200).json({ message: 'Book returned successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const { status } = req.query; // 'Issued' | 'Returned' | 'Overdue' (Custom logic for overdue)
        let query = transactionsCollection;

        if (status && status !== 'Overdue') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.orderBy('issueDate', 'desc').get();
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOverdueTransactions = async (req, res) => {
    try {
        const today = new Date().toISOString();
        // In Firestore, comparing dates stored as strings works if ISO format is used.
        // Ideally use Timestamps, but ISO string is simple for now. 
        // Logic: status == 'Issued' AND expectedReturnDate < today

        const snapshot = await transactionsCollection.where('status', '==', 'Issued')
            .where('expectedReturnDate', '<', today)
            .get();

        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
