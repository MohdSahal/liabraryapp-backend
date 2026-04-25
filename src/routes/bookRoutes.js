const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createBook, getBooks, getBookById, updateBook, deleteBook, bulkCreateBooks } = require('../controllers/bookController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), createBook);
router.post('/bulk', bulkCreateBooks);
router.get('/', getBooks);
router.get('/:id', getBookById);
router.put('/:id', upload.single('image'), updateBook);
router.delete('/:id', deleteBook);

module.exports = router;
