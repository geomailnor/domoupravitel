// backend/src/auth.js
import jwt from 'jsonwebtoken';

// Създава JWT токен от подадените данни
export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Middleware: проверява дали заявката има валиден токен
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Липсва токен' });
  }

  const token = header.slice(7); // маха "Bearer "

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Невалиден или изтекъл токен' });
  }
}

// Middleware: изисква роля "admin"
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Достъп само за админ' });
  }
  next();
}