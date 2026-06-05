const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const ACCOUNTS_COLLECTION = "accounts";

/**
 * GET /
 * List all accounts (Type and Name only - no credentials exposed).
 */
router.get("/", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const snapshot = await db.collection(ACCOUNTS_COLLECTION).get();

    const accounts = snapshot.docs.map((doc) => ({
      id: doc.id,
      Type: doc.data().Type || null,
      Name: doc.data().Name || null,
    }));

    return res.json(accounts);
  } catch (err) {
    console.error("GET /accounts error:", err.message);
    return res.status(500).json({ error: "Failed to fetch accounts." });
  }
});

/**
 * GET /:id
 * Get a single account with full details.
 */
router.get("/:id", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(ACCOUNTS_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Account not found." });
    }

    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error("GET /accounts/:id error:", err.message);
    return res.status(500).json({ error: "Failed to fetch account." });
  }
});

/**
 * POST /
 * Add a new account.
 * Body: { Name, Username, Password, Others, Type }
 * Checks for duplicate names.
 */
router.post("/", async (req, res) => {
  try {
    const { Name, Username, Password, Others, Type } = req.body;

    if (!Name || !Type) {
      return res.status(400).json({ error: "Name and Type are required." });
    }

    const db = getFirestoreForUser(req.user.email);

    // Check for duplicate name
    const existing = await db
      .collection(ACCOUNTS_COLLECTION)
      .where("Name", "==", Name)
      .get();

    if (!existing.empty) {
      return res.status(409).json({
        error: `An account with the name "${Name}" already exists.`,
      });
    }

    const data = {
      Name,
      Username: Username || "",
      Password: Password || "",
      Others: Others || "",
      Type,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection(ACCOUNTS_COLLECTION).add(data);

    return res.status(201).json({ id: docRef.id, ...data });
  } catch (err) {
    console.error("POST /accounts error:", err.message);
    return res.status(500).json({ error: "Failed to add account." });
  }
});

/**
 * PUT /:id
 * Update an account.
 */
router.put("/:id", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(ACCOUNTS_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Account not found." });
    }

    const updates = {};
    const allowedFields = ["Name", "Username", "Password", "Others", "Type"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    updates.updatedAt = new Date().toISOString();
    await docRef.update(updates);

    return res.json({ id: req.params.id, ...updates });
  } catch (err) {
    console.error("PUT /accounts/:id error:", err.message);
    return res.status(500).json({ error: "Failed to update account." });
  }
});

/**
 * DELETE /:id
 * Delete an account.
 */
router.delete("/:id", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(ACCOUNTS_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Account not found." });
    }

    await docRef.delete();

    return res.json({ message: "Account deleted.", id: req.params.id });
  } catch (err) {
    console.error("DELETE /accounts/:id error:", err.message);
    return res.status(500).json({ error: "Failed to delete account." });
  }
});

module.exports = router;
