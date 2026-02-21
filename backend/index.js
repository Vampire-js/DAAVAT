import 'dotenv/config'; 
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

// Import your routes
import authRoutes from './routes/auth.js';
import fileTreeRoutes from './routes/fileTree.js';

const app = express();

// --- 1. CORS CONFIGURATION (MUST BE TOP PRIORITY) ---
const corsOptions = {
  // Use explicit origin rather than a function for localhost to avoid handshake issues
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// This handles ALL CORS requests (including preflight OPTIONS)
app.use(cors(corsOptions));

// Note: In Express 5, do NOT use app.options('*') or app.options('(.*)') 
// as it causes "Missing parameter name" errors. app.use(cors()) is sufficient.

// --- 2. OTHER MIDDLEWARE ---
// Helmet is great, but ensure it doesn't block cross-origin resources in dev
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
app.use(cookieParser());

// --- 3. ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/fileTree', fileTreeRoutes);

// --- 4. DATABASE & SERVER ---
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Mongo connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection error', err);
  });