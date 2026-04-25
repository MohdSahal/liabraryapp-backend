const express = require('express');
const router = express.Router();
const { createUser, getUsers, getUserById, updateUser, deleteUser, bulkCreateUsers } = require('../controllers/userController');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), createUser);
router.post('/bulk', bulkCreateUsers);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', upload.single('image'), updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
