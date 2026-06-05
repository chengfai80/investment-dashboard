const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

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
 * GET /:collection/field-values/:field
 * Returns unique values for a given field in a collection.
 * Useful for dropdowns and auto-suggest.
 */
router.get("/:collection/field-values/:field", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const snapshot = await db.collection(req.params.collection).get();
    const field = req.params.field;
    const values = new Set();
    snapshot.docs.forEach((doc) => {
      const val = doc.data()[field];
      if (val != null && String(val).trim()) values.add(String(val));
    });
    return res.json([...values].sort());
  } catch (err) {
    console.error("GET /:collection/field-values/:field error:", err.message);
    return res.status(500).json({ error: "Failed to fetch field values." });
  }
});

/**
 * GET /:collection
 */
router.get("/:collection", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const snapshot = await db.collection(req.params.collection).get();
    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(docs);
  } catch (err) {
    console.error("GET /:collection error:", err.message);
    return res.status(500).json({ error: "Failed to fetch documents." });
  }
});

/**
 * Handle dependent transactions (matching Streamlit handle_dependent_transaction).
 * Auto-creates related records when specific transactions are added.
 */
async function handleDependentTransaction(db, email, collectionName, data) {
  const dependents = [];

  if (collectionName === "banks") {
    const description = (data.Description || "").toLowerCase();
    const bankName = (data.Name || "").toLowerCase();
    const expenseCategory = (data["Expense Category"] || "").toLowerCase();

    // Car Installment -> carloan
    if (description === "car installment") {
      let car = null;
      if (bankName === "pbb") car = "Serena";
      else if (bankName === "ambank") car = "CX30";

      if (car) {
        const additionalData = {
          Date: data.Date,
          Name: car,
          Type: "Car Loan",
          Amount: Math.abs(parseFloat(data.Amount) || 0),
        };
        const ref = await db.collection("carloan").add(additionalData);
        dependents.push({ collection: "carloan", id: ref.id, name: car });
      }
    }

    // Kid's Saving -> kid bank or SSPN
    if (expenseCategory === "kid's saving") {
      if (description === "transfer (hin)") {
        const additionalData = {
          Date: data.Date,
          Name: "Hin MBB",
          Type: "Bank",
          Description: "Transfer (MBB)",
          "Expense Category": "Saving",
          Amount: Math.abs(parseFloat(data.Amount) || 0),
        };
        const ref = await db.collection("banks").add(additionalData);
        dependents.push({ collection: "banks", id: ref.id, name: "Hin MBB" });
      } else if (description === "transfer (yao)") {
        const additionalData = {
          Date: data.Date,
          Name: "Yao MBB",
          Type: "Bank",
          Description: "Transfer (MBB)",
          "Expense Category": "Saving",
          Amount: Math.abs(parseFloat(data.Amount) || 0),
        };
        const ref = await db.collection("banks").add(additionalData);
        dependents.push({ collection: "banks", id: ref.id, name: "Yao MBB" });
      } else if (description === "sspn (hin)") {
        const additionalData = {
          Date: data.Date,
          Name: "Lum Zi Hin",
          Type: "SSPN",
          Activity: "Deposit",
          Amount: Math.abs(parseFloat(data.Amount) || 0),
        };
        const ref = await db.collection("sspn").add(additionalData);
        dependents.push({ collection: "sspn", id: ref.id, name: "Lum Zi Hin" });
      } else if (description === "sspn (yao)") {
        const additionalData = {
          Date: data.Date,
          Name: "Lum Zi Yao",
          Type: "SSPN",
          Activity: "Deposit",
          Amount: Math.abs(parseFloat(data.Amount) || 0),
        };
        const ref = await db.collection("sspn").add(additionalData);
        dependents.push({ collection: "sspn", id: ref.id, name: "Lum Zi Yao" });
      }
    }

    // House Loan Installment from Ambank -> houseloan
    if (description === "house loan installment" && bankName === "ambank") {
      const additionalData = {
        Date: data.Date,
        Description: "Interest",
        Amount: parseFloat(data.Amount) || 0,
      };
      const ref = await db.collection("houseloan").add(additionalData);
      dependents.push({ collection: "houseloan", id: ref.id, name: "House Loan" });
    }
  }

  return dependents;
}

/**
 * POST /:collection
 * Add a new document. Handles dependent transactions for banks.
 * Auto-negates bank expense amounts based on category type.
 */
router.post("/:collection", validateCollection, async (req, res) => {
  try {
    const db = getFirestoreForUser(req.user.email);
    const email = req.user.email;
    const collectionName = req.params.collection;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body cannot be empty." });
    }

    const processed = processDateFields(data);

    // For banks: auto-negate amount based on category type
    if (collectionName === "banks" && processed["Expense Category"]) {
      try {
        const categoryDocs = await db.collection("category").get();
        const categoryTypeMap = {};
        categoryDocs.forEach((doc) => {
          const d = doc.data();
          if (d.Category && d.Type) categoryTypeMap[d.Category] = d.Type;
        });

        const catType = categoryTypeMap[processed["Expense Category"]];
        if (catType === "Expense") {
          processed.Amount = -Math.abs(parseFloat(processed.Amount) || 0);
        } else if (catType === "Income") {
          processed.Amount = Math.abs(parseFloat(processed.Amount) || 0);
        }
      } catch (catErr) {
        console.error("Category lookup failed:", catErr.message);
      }
    }

    const docRef = await db.collection(collectionName).add(processed);

    // Handle dependent transactions (chengfai only for now, but logic works for both)
    let dependents = [];
    try {
      dependents = await handleDependentTransaction(db, email, collectionName, processed);
    } catch (depErr) {
      console.error("Dependent transaction error:", depErr.message);
    }

    return res.status(201).json({
      id: docRef.id,
      ...processed,
      dependentTransactions: dependents,
    });
  } catch (err) {
    console.error("POST /:collection error:", err.message);
    return res.status(500).json({ error: "Failed to add document." });
  }
});

/**
 * PUT /:collection/:id
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
