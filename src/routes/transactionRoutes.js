const express = require('express');
const router = express.Router();
const { issueBook, returnBook, getTransactions, getOverdueTransactions } = require('../controllers/transactionController');

router.post('/issue', issueBook);
router.post('/return/:id', returnBook);
router.get('/', getTransactions);
router.get('/overdue', getOverdueTransactions);

module.exports = router;
