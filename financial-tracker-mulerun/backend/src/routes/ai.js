const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { COLLECTION_FIELDS, getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-pro";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Build a system prompt that describes the user's collections, schemas, and row counts.
 */
async function buildSystemPrompt(email, db) {
  const collections = getCollectionsForUser(email);
  const fields = COLLECTION_FIELDS[email] || {};

  const collectionDescriptions = [];

  for (const colName of collections) {
    try {
      const snapshot = await db.collection(colName).limit(1).get();
      const countSnapshot = await db.collection(colName).count().get();
      const rowCount = countSnapshot.data().count;

      let columns = fields[colName] || [];

      // If schema fields are empty, infer from first document
      if (columns.length === 0 && !snapshot.empty) {
        columns = Object.keys(snapshot.docs[0].data());
      }

      collectionDescriptions.push(
        `- **${colName}**: ${rowCount} rows, columns: [${columns.join(", ")}]`
      );
    } catch {
      collectionDescriptions.push(`- **${colName}**: (unable to read)`);
    }
  }

  return [
    "You are Financial Mate, an AI assistant for a personal financial tracker app.",
    "You help users understand their financial data, answer questions, and provide insights.",
    "",
    `User: ${email}`,
    "",
    "Available Firestore collections and their schemas:",
    ...collectionDescriptions,
    "",
    "Important notes:",
    "- All monetary values are in MYR unless otherwise noted (some shares may be in USD).",
    "- Dates are stored as ISO strings.",
    "- Provide clear, concise answers about the user's finances.",
    "- When asked about trends, reference specific numbers from the data.",
    "- Do not make up data. If you cannot answer from the schema, say so.",
    "- You cannot execute code or queries. Provide analytical text responses only.",
  ].join("\n");
}

/**
 * POST /chat
 * Body: { message }
 * Calls Gemini API with system prompt + user message.
 * Returns { response, type: "text" }
 */
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service is not configured." });
    }

    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const systemPrompt = await buildSystemPrompt(email, db);

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errBody);
      return res.status(502).json({ error: "AI service returned an error." });
    }

    const geminiData = await geminiResponse.json();

    const aiText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I was unable to generate a response. Please try again.";

    // Save to chat history
    try {
      const chatRef = db
        .collection("users")
        .doc(email)
        .collection("lumai_chats")
        .doc("default")
        .collection("messages");

      await chatRef.add({
        userMessage: message,
        aiResponse: aiText,
        timestamp: new Date().toISOString(),
      });
    } catch (historyErr) {
      // Non-fatal: log but don't fail the response
      console.error("Failed to save chat history:", historyErr.message);
    }

    return res.json({ response: aiText, type: "text" });
  } catch (err) {
    console.error("POST /ai/chat error:", err.message);
    return res.status(500).json({ error: "Failed to process AI request." });
  }
});

/**
 * GET /history
 * Get chat history from Firestore (users/{email}/lumai_chats/default/messages).
 */
router.get("/history", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const chatRef = db
      .collection("users")
      .doc(email)
      .collection("lumai_chats")
      .doc("default")
      .collection("messages");

    const snapshot = await chatRef.orderBy("timestamp", "asc").get();

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json(messages);
  } catch (err) {
    console.error("GET /ai/history error:", err.message);
    return res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

/**
 * DELETE /history
 * Clear chat history.
 */
router.delete("/history", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const chatRef = db
      .collection("users")
      .doc(email)
      .collection("lumai_chats")
      .doc("default")
      .collection("messages");

    const snapshot = await chatRef.get();

    if (snapshot.empty) {
      return res.json({ message: "No chat history to clear." });
    }

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    return res.json({
      message: "Chat history cleared.",
      deletedCount: docs.length,
    });
  } catch (err) {
    console.error("DELETE /ai/history error:", err.message);
    return res.status(500).json({ error: "Failed to clear chat history." });
  }
});

module.exports = router;
