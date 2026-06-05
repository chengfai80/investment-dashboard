const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const { db } = require('../models');
const { authenticate } = require('../middleware/auth');

const usersCol = db.collection('users');

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if email already exists
    const existing = await usersCol.where('email', '==', email).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const userRef = usersCol.doc();
    const userData = {
      username,
      email,
      password: hashed,
      mfaSecret: null,
      mfaEnabled: false,
      refreshToken: null,
      createdAt: new Date().toISOString(),
    };

    const tokens = generateTokens(userRef.id);
    userData.refreshToken = tokens.refreshToken;
    await userRef.set(userData);

    res.status(201).json({
      user: { id: userRef.id, username, email, mfaEnabled: false },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    const snapshot = await usersCol.where('email', '==', email).limit(1).get();
    if (snapshot.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // If MFA is enabled, require code
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return res.status(200).json({ mfaRequired: true, message: 'MFA code required' });
      }
      const mfaValid = authenticator.verify({ token: mfaCode, secret: user.mfaSecret });
      if (!mfaValid) return res.status(401).json({ error: 'Invalid MFA code' });
    }

    const tokens = generateTokens(user.id);
    await usersCol.doc(user.id).update({ refreshToken: tokens.refreshToken });

    res.json({
      user: { id: user.id, username: user.username, email: user.email, mfaEnabled: user.mfaEnabled },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const userDoc = await usersCol.doc(decoded.userId).get();
    if (!userDoc.exists) return res.status(401).json({ error: 'Invalid refresh token' });

    const user = userDoc.data();
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(decoded.userId);
    await usersCol.doc(decoded.userId).update({ refreshToken: tokens.refreshToken });
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Setup MFA
router.post('/mfa/setup', authenticate, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(req.user.email, 'SecureNotes', secret);
    await usersCol.doc(req.user.id).update({ mfaSecret: secret });
    res.json({ secret, otpauthUrl });
  } catch (err) {
    res.status(500).json({ error: 'MFA setup failed' });
  }
});

// Verify & enable MFA
router.post('/mfa/verify', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    // Re-fetch to get latest mfaSecret
    const userDoc = await usersCol.doc(req.user.id).get();
    const user = userDoc.data();
    const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    await usersCol.doc(req.user.id).update({ mfaEnabled: true });
    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

// Disable MFA
router.post('/mfa/disable', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userDoc = await usersCol.doc(req.user.id).get();
    const user = userDoc.data();
    const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    await usersCol.doc(req.user.id).update({ mfaEnabled: false, mfaSecret: null });
    res.json({ message: 'MFA disabled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    mfaEnabled: req.user.mfaEnabled,
  });
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  await usersCol.doc(req.user.id).update({ refreshToken: null });
  res.json({ message: 'Logged out' });
});

module.exports = router;
