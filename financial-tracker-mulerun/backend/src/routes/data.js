const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Validate that the requested collection is configured for the user.
 */
function validateCollection(req, res, next) {
  const { collection } = req.params;
  const email = req.user.email;

  try {
    const allowed = getCollectionsForUser(email);
    if (!allowed.includes(collection)) {
      return res.status(400).json({
        error: `Collection "${collection}" is not available for this user.`,
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /:collection
 * List all documents from a Firestore collection.
 * Returns an array of { id, ...fields }.
 */
router.get("/:collection", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const snapshot = await db.collection(req.params.collection).get();

    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json(docs);
  } catch (err) {
    console.error("GET /:collection error:", err.message);
    return res.status(500).json({ error: "Failed to fetch documents." });
  }
});

/**
 * POST /:collection
 * Add a new document. Body = field values.
 * Date fields are stored as ISO strings.
 */
router.post("/:collection", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body cannot be empty." });
    }

    // Convert date fields to ISO strings
    const processed = processDateFields(data);

    const docRef = await db.collection(req.params.collection).add(processed);

    return res.status(201).json({ id: docRef.id, ...processed });
  } catch (err) {
    console.error("POST /:collection error:", err.message);
    return res.status(500).json({ error: "Failed to add document." });
  }
});

/**
 * PUT /:collection/:id
 * Update an existing document.
 */
router.put("/:collection/:id", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const { collection, id } = req.params;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body cannot be empty." });
    }

    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Document not found." });
    }

    const processed = processDateFields(data);
    await docRef.update(processed);

    return res.json({ id, ...processed });
  } catch (err) {
    console.error("PUT /:collection/:id error:", err.message);
    return res.status(500).json({ error: "Failed to update document." });
  }
});

/**
 * DELETE /:collection/:id
 * Delete a document.
 */
router.delete("/:collection/:id", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const { collection, id } = req.params;

    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Document not found." });
    }

    await docRef.delete();

    return res.json({ message: "Document deleted.", id });
  } catch (err) {
    console.error("DELETE /:collection/:id error:", err.message);
    return res.status(500).json({ error: "Failed to delete document." });
  }
});

/**
 * Convert Date objects and date-like strings to ISO strings for storage.
 */
function processDateFields(data) {
  const processed = { ...data };

  for (const [key, value] of Object.entries(processed)) {
    if (value instanceof Date) {
      processed[key] = value.toISOString();
    } else if (
      typeof value === "string" &&
      /date/i.test(key) &&
      !isNaN(Date.parse(value))
    ) {
      processed[key] = new Date(value).toISOString();
    }
  }

  return processed;
}

module.exports = router;
