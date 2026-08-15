const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const adminRoutes = require('./routes/adminRoutes');
const hodRoutes = require('./routes/hodRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const bulkOperationsRoutes = require('./routes/bulkOperationsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminAiRoutes = require('./routes/adminAiRoutes');
const searchRoutes = require('./routes/searchRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin/ai', adminAiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/bulk', bulkOperationsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

app.use(errorMiddleware);

connectDB();

module.exports = app;
