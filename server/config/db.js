import mongoose from 'mongoose';

/**
 * Connects to MongoDB database using Mongoose
 */
export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jobtrack');
    console.log(`[JobTrack Backend] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[JobTrack Backend] MongoDB Connection Error: ${error.message}`);
    console.warn(`[JobTrack Backend] Make sure local MongoDB service is running, or set MONGODB_URI in server/.env`);
  }
}
