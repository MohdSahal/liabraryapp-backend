const express = require('express');
const router = express.Router();
const { getIssuedBooksReport, getReturnedBooksReport, getOverdueReport, getTopBooks } = require('../controllers/reportController');

router.get('/issued', getIssuedBooksReport);
router.get('/returned', getReturnedBooksReport);
router.get('/overdue', getOverdueReport);
router.get('/top-books', getTopBooks);

module.exports = router;
