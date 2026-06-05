const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticateToken, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const TOKEN_EXPIRY = "8h";

/**
 * Allowed users with their Firebase Web API keys and display names.
 */
const ALLOWED_USERS = {
  "chengfai@hotmail.com": {
    apiKey: "AIzaSyCrIBLkwz114iEHDS6J0kWk0QNiXBk9Ls8",
    displayName: "ChengFai",
  },
  "engseeaw@gmail.com": {
    apiKey: "AIzaSyA412O6Y4lycWMxG2Sw7L6SS6-AZB6AvU8",
    displayName: "EngSee",
  },
};

/**
 * Sign in via Firebase Auth REST API.
 * @param {string} email
 * @param {string} password
 * @param {string} apiKey - Firebase Web API key for the user's project
 * @returns {Promise<object>} Firebase Auth response body
 */
async function firebaseSignIn(email, password, apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Authentication failed";
    const err = new Error(message);
    err.status = 401;
    throw err;
  }

  return data;
}

/**
 * POST /auth/login
 * Body: { email, password }
 * Validates user is allowed, authenticates via Firebase Auth REST API,
 * then returns a signed JWT.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userConfig = ALLOWED_USERS[normalizedEmail];

    if (!userConfig) {
      return res.status(403).json({ error: "User not authorized." });
    }

    // Verify credentials against Firebase Auth REST API
    await firebaseSignIn(normalizedEmail, password, userConfig.apiKey);

    // Build and sign JWT
    const payload = {
      email: normalizedEmail,
      displayName: userConfig.displayName,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    return res.json({
      token,
      user: payload,
      expiresIn: TOKEN_EXPIRY,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      error: status === 401 ? "Invalid email or password." : "Login failed.",
    });
  }
});

/**
 * POST /auth/refresh
 * Requires a valid (non-expired) JWT. Returns a fresh token.
 */
router.post("/refresh", authenticateToken, (req, res) => {
  const payload = {
    email: req.user.email,
    displayName: req.user.displayName,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  return res.json({
    token,
    user: payload,
    expiresIn: TOKEN_EXPIRY,
  });
});

/**
 * GET /auth/me
 * Returns the current authenticated user's info.
 */
router.get("/me", authenticateToken, (req, res) => {
  return res.json({
    email: req.user.email,
    displayName: req.user.displayName,
  });
});

module.exports = router;
