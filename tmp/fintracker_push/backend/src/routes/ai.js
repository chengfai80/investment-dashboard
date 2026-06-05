const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { COLLECTION_FIELDS, getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Build a system prompt that describes the user's collections, schemas, and row counts.
 */
async function buildSystemPrompt(email, db) {
  const collections = getCollectionsForUser(email);
  const fields = COLLECTION_FIELDS[email] || {};

  // Fetch all collections in parallel for speed
  const results = await Promise.allSettled(
    collections.map(async (colName) => {
      const snapshot = await db.collection(colName).limit(30).get();
      let columns = fields[colName] || [];
      if (columns.length === 0 && !snapshot.empty) {
        columns = Object.keys(snapshot.docs[0].data());
      }
      const rows = snapshot.docs.map((doc) => doc.data());
      return { colName, columns, rows, rowCount: rows.length };
    })
  );

  const collectionDescriptions = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { colName, columns, rows, rowCount } = result.value;
      collectionDescriptions.push(
        `- **${colName}**: ${rowCount} rows, columns: [${columns.join(", ")}]`
      );
      if (rows.length > 0) {
        // Truncate large data to avoid exceeding token limits
        const dataStr = JSON.stringify(rows);
        const maxLen = 8000;
        collectionDescriptions.push(
          `  Data: ${dataStr.length > maxLen ? dataStr.substring(0, maxLen) + "...(truncated)" : dataStr}`
        );
      }
    } else {
      // Find collection name from the index
      const idx = results.indexOf(result);
      collectionDescriptions.push(`- **${collections[idx]}**: (unable to read)`);
    }
  }

  return [
    "You are a financial data assistant for a personal financial tracker app.",
    "",
    "CONTEXT:",
    `- Current user: ${email}`,
    "- Financial data collections and schemas are listed below.",
    "",
    "DATA:",
    ...collectionDescriptions,
    "",
    "COLLECTION RULES (short summary):",
    "banks - transactions, income = positive (exclude keyword like Transfer, Balance), expense = negative (exclude keyword like Transfer, FD Placement, Credit Card Payment).",
    "cardusage - all expenses, positive values. HSBC cycle: prev 20 → curr 19. Alliance cycle: curr 3 → next 2.",
    "carloan - contains car installment made monthly based on car name.",
    "category - contains the category that used by expense_category for banks and cardusage and indicate whether it is income or expense by type.",
    "commitment - contains the commitment needed every month",
    "epf - one of the investment for retirement fund",
    "expensesummary - contains the monthly expenses and salary",
    "fd - fixed deposits",
    "houseloan - contains house loan installment made monthly",
    "houseloaninfo - contains house property price, loan interest, loan amount etc.",
    "insurance - contains all the insurance policies by insurer",
    "insuranceinvestment - contains all the investment from insurance by insurer. Total amount will be based on number_of_units multiply by unit_price.",
    "investment - other investment",
    "share - stocks from share market. Status On-hand means still holding, Sold means already sold.",
    "sspn - kids investment.",
    "",
    "GENERAL RULES:",
    "- All monetary values are in MYR unless otherwise noted (some shares may be in USD).",
    "- Dates are stored as ISO strings.",
    "- Provide clear, concise answers about the user's finances.",
    "- When asked about trends, reference specific numbers from the data.",
    "- Do not make up data. If you cannot answer from the available data, say so.",
    "- Always use try/except around risky operations.",
    "- Avoid repeating \"Of course\" or \"Here is the explanation\". Just explain the outcome straight.",
    "- Be specific with numbers - always format monetary values to 2 decimal places.",
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
      console.error("GEMINI_API_KEY environment variable is not set");
      return res.status(503).json({ error: "AI service is not configured. Please set the GEMINI_API_KEY environment variable on Cloud Run." });
    }

    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const systemPrompt = await buildSystemPrompt(email, db);

    // Load recent chat history for context (last 10 exchanges)
    const chatHistoryContents = [];
    try {
      const chatRef = db
        .collection("users")
        .doc(email)
        .collection("lumai_chats")
        .doc("default")
        .collection("messages");
      const histSnap = await chatRef.orderBy("timestamp", "asc").limitToLast(10).get();
      histSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userMessage) {
          chatHistoryContents.push({ role: "user", parts: [{ text: d.userMessage }] });
        }
        if (d.aiResponse) {
          chatHistoryContents.push({ role: "model", parts: [{ text: d.aiResponse }] });
        }
      });
    } catch (_) {
      // non-fatal, proceed without history
    }

    // Append current message
    chatHistoryContents.push({ role: "user", parts: [{ text: message }] });

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: chatHistoryContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errBody);
      let errDetail = "AI service returned an error.";
      try {
        const errJson = JSON.parse(errBody);
        errDetail = errJson?.error?.message || errDetail;
      } catch (_) {}
      return res.status(502).json({ error: `Gemini error (${geminiResponse.status}): ${errDetail}` });
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
    console.error("POST /ai/chat error:", err.message, err.stack);
    return res.status(500).json({ error: `AI request failed: ${err.message}` });
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

    const messages = [];
    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      messages.push({
        id: doc.id,
        role: 'user',
        type: 'text',
        content: d.userMessage,
        timestamp: d.timestamp,
      });
      messages.push({
        id: doc.id + '_ai',
        role: 'assistant',
        type: 'text',
        content: d.aiResponse,
        timestamp: d.timestamp,
      });
    });

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
