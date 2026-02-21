import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

const COOKIE_NAME = process.env.COOKIE_NAME || 'access_token';

export function requireAuth(req, res, next) {
  // 1. Log the secret status for debugging (Server terminal only)
  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET is missing from .env");
    return res.status(500).json({ message: "Server configuration error" });
  }

  // 2. Check for token in cookies
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    // If this triggers after login, it means 'credentials: include' is missing in frontend fetch
    return res.status(401).json({ message: 'Not authenticated - No cookie found' });
  }

  try {
    // 3. Verify using the latest secret from process.env
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Attach user data to request
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    console.error("JWT Verification failed:", err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}