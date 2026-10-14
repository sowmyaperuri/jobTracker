import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import jobRoutes from './routes/jobRoutes.js';

// Load Environment Variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple Request Logger (shows every incoming request in terminal)
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false });
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/applications', jobRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '⚡ JobTrack REST API Server Running',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 [JobTrack Backend] Server listening on http://localhost:${PORT}`);
  console.log(`📌 API Endpoint: http://localhost:${PORT}/api/applications\n`);
});
