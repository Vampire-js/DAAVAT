import dotenv from 'dotenv';
dotenv.config();

//import dependencies as ES modules
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

//import your routes
import authRoutes from './routes/auth.js';
import fileTreeRoutes from './routes/fileTree.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Configure CORS. In development allow any local origin (helps when
// Next dev server is accessed via localhost, 127.0.0.1, or LAN IP).
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests like curl
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    // in production restrict to configured origin
    if (origin === process.env.CORS_ORIGIN) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use('/api/auth', authRoutes);
app.use('/api/fileTree', fileTreeRoutes);

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
.then(() => {
  console.log('Mongo connected');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch(err => {
  console.error('DB connection error', err);
});
