const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const TEMPLATES_COLLECTION = "transaction_templates";

/**
 * GET /
 * List all templates.
 */
router.get("/", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const snapshot = await db.collection(TEMPLATES_COLLECTION).get();

    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json(templates);
  } catch (err) {
    console.error("GET /templates error:", err.message);
    return res.status(500).json({ error: "Failed to fetch templates." });
  }
});

/**
 * POST /
 * Create a new template.
 * Body: { name, entries: [{ collection, data }] }
 */
router.post("/", async (req, res) => {
  try {
    const { name, entries } = req.body;

    if (!name || !entries || !Array.isArray(entries)) {
      return res.status(400).json({
        error: "Template requires a name and entries array.",
      });
    }

    // Validate that all referenced collections exist for this user
    const allowed = getCollectionsForUser(req.user.email);
    for (const entry of entries) {
      if (!entry.collection || !entry.data) {
        return res.status(400).json({
          error: "Each entry must have a collection and data.",
        });
      }
      if (!allowed.includes(entry.collection)) {
        return res.status(400).json({
          error: `Collection "${entry.collection}" is not available for this user.`,
        });
      }
    }

    const db = getFirestoreForUser(req.user.email);
    const template = { name, entries, createdAt: new Date().toISOString() };

    const docRef = await db.collection(TEMPLATES_COLLECTION).add(template);

    return res.status(201).json({ id: docRef.id, ...template });
  } catch (err) {
    console.error("POST /templates error:", err.message);
    return res.status(500).json({ error: "Failed to create template." });
  }
});

/**
 * PUT /:id
 * Update a template.
 */
router.put("/:id", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(TEMPLATES_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Template not found." });
    }

    const { name, entries } = req.body;

    if (entries && Array.isArray(entries)) {
      const allowed = getCollectionsForUser(req.user.email);
      for (const entry of entries) {
        if (!entry.collection || !entry.data) {
          return res.status(400).json({
            error: "Each entry must have a collection and data.",
          });
        }
        if (!allowed.includes(entry.collection)) {
          return res.status(400).json({
            error: `Collection "${entry.collection}" is not available for this user.`,
          });
        }
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (entries !== undefined) updates.entries = entries;
    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    return res.json({ id: req.params.id, ...updates });
  } catch (err) {
    console.error("PUT /templates/:id error:", err.message);
    return res.status(500).json({ error: "Failed to update template." });
  }
});

/**
 * DELETE /:id
 * Delete a template.
 */
router.delete("/:id", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(TEMPLATES_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Template not found." });
    }

    await docRef.delete();

    return res.json({ message: "Template deleted.", id: req.params.id });
  } catch (err) {
    console.error("DELETE /templates/:id error:", err.message);
    return res.status(500).json({ error: "Failed to delete template." });
  }
});

/**
 * POST /:id/apply
 * Apply a template: add each entry to its target collection with Date set to now (Malaysia timezone).
 */
router.post("/:id/apply", async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const docRef = db.collection(TEMPLATES_COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Template not found." });
    }

    const template = doc.data();
    const entries = template.entries || [];

    if (entries.length === 0) {
      return res.status(400).json({ error: "Template has no entries to apply." });
    }

    // Get current date in Malaysia timezone (UTC+8)
    const now = new Date();
    const malaysiaDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const dateISO = malaysiaDate.toISOString();

    const results = [];
    const batch = db.batch();

    for (const entry of entries) {
      const colRef = db.collection(entry.collection);
      const newDocRef = colRef.doc();
      const data = { ...entry.data, Date: dateISO };
      batch.set(newDocRef, data);
      results.push({ id: newDocRef.id, collection: entry.collection, ...data });
    }

    await batch.commit();

    return res.status(201).json({
      message: `Applied template "${template.name}" with ${results.length} entries.`,
      entries: results,
    });
  } catch (err) {
    console.error("POST /templates/:id/apply error:", err.message);
    return res.status(500).json({ error: "Failed to apply template." });
  }
});

module.exports = router;
