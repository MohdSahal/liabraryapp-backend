const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// const { verifyToken } = require('./middleware/authMiddleware'); // To be implemented

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes (Placeholders)
app.get('/', (req, res) => {
  res.send('Library Management API is running...');
});

// Middleware
const { verifyToken } = require('./middleware/authMiddleware');

// Public Route (if any, e.g. login if handled by backend, but here auth is frontend-first)
app.use('/uploads', express.static('uploads'));
// app.use('/api/auth', require('./routes/authRoutes'));

// Protected Routes
app.use('/api/books', verifyToken, require('./routes/bookRoutes'));
app.use('/api/users', verifyToken, require('./routes/userRoutes'));
app.use('/api/transactions', verifyToken, require('./routes/transactionRoutes'));
app.use('/api/reports', verifyToken, require('./routes/reportRoutes'));
app.use('/api/dashboard', verifyToken, require('./routes/dashboardRoutes'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
