const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const USD_MYR_RATE = parseFloat(process.env.USD_MYR_RATE) || 4.42;

// --- Helper: fetch all docs from a collection (returns [] if collection doesn't exist for user) ---
async function fetchCollection(db, email, collectionName) {
  const allowed = getCollectionsForUser(email);
  if (!allowed.includes(collectionName)) return [];
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// --- Helper: safe numeric parse ---
function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// --- Helper: format YYYY-MM from a date string ---
function toYearMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * GET /wealth
 * Computes a wealth summary with category breakdown for pie chart.
 */
router.get("/wealth", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const [banks, fd, epf, investment, share, insuranceinvestment, houseloan, carloan] =
      await Promise.all([
        fetchCollection(db, email, "banks"),
        fetchCollection(db, email, "fd"),
        fetchCollection(db, email, "epf"),
        fetchCollection(db, email, "investment"),
        fetchCollection(db, email, "share"),
        fetchCollection(db, email, "insuranceinvestment"),
        fetchCollection(db, email, "houseloan"),
        fetchCollection(db, email, "carloan"),
      ]);

    // Total bank balances (exclude specific types like Credit Card, Loan, etc.)
    const excludedBankTypes = ["Credit Card", "Loan", "credit card", "loan"];
    const totalBanks = banks
      .filter((b) => !excludedBankTypes.includes(b.Type))
      .reduce((sum, b) => sum + toNum(b.Amount || b.Balance || b.balance), 0);

    // Total FD
    const totalFD = fd.reduce((sum, f) => sum + toNum(f.Amount || f.amount), 0);

    // Total EPF
    const totalEPF = epf.reduce((sum, e) => sum + toNum(e.Amount || e.amount), 0);

    // Total investments
    const totalInvestment = investment.reduce(
      (sum, i) => sum + toNum(i.Amount || i.amount || i.Value || i.value),
      0
    );

    // Total shares (handle USD conversion)
    const totalShares = share.reduce((sum, s) => {
      const amount = toNum(s.Amount || s.amount || s.Value || s.value);
      const currency = (s.Currency || s.currency || "MYR").toUpperCase();
      return sum + (currency === "USD" ? amount * USD_MYR_RATE : amount);
    }, 0);

    // Total insurance investments (units * price)
    const totalInsuranceInvestment = insuranceinvestment.reduce(
      (sum, ii) => sum + toNum(ii.Units || ii.units) * toNum(ii.Price || ii.price),
      0
    );

    // Debt (chengfai only: houseloan + carloan outstanding)
    let totalDebt = 0;
    if (email === "chengfai@hotmail.com") {
      const hlDebt = houseloan.reduce(
        (sum, h) => sum + toNum(h.Outstanding || h.outstanding || h.Balance || h.balance),
        0
      );
      const clDebt = carloan.reduce(
        (sum, c) => sum + toNum(c.Outstanding || c.outstanding || c.Balance || c.balance),
        0
      );
      totalDebt = hlDebt + clDebt;
    }

    const breakdown = [
      { category: "Banks", amount: totalBanks },
      { category: "Fixed Deposit", amount: totalFD },
      { category: "EPF", amount: totalEPF },
      { category: "Investments", amount: totalInvestment },
      { category: "Shares", amount: totalShares },
      { category: "Insurance Investment", amount: totalInsuranceInvestment },
    ];

    const totalWealth =
      totalBanks + totalFD + totalEPF + totalInvestment + totalShares + totalInsuranceInvestment;

    const result = {
      totalWealth,
      totalDebt,
      netWealth: totalWealth - totalDebt,
      breakdown,
      usdMyrRate: USD_MYR_RATE,
    };

    return res.json(result);
  } catch (err) {
    console.error("GET /wealth error:", err.message);
    return res.status(500).json({ error: "Failed to compute wealth summary." });
  }
});

/**
 * GET /income-summary
 * Monthly income from banks collection (positive amounts, excluding transfers).
 */
router.get("/income-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const banks = await fetchCollection(db, email, "banks");

    const monthlyIncome = {};

    for (const entry of banks) {
      const amount = toNum(entry.Amount || entry.amount);
      const category = (entry.Category || entry.category || "").toLowerCase();

      // Only positive amounts, exclude transfers
      if (amount <= 0) continue;
      if (category.includes("transfer")) continue;

      const ym = toYearMonth(entry.Date || entry.date);
      if (!ym) continue;

      if (!monthlyIncome[ym]) monthlyIncome[ym] = 0;
      monthlyIncome[ym] += amount;
    }

    // Sort by month
    const sorted = Object.entries(monthlyIncome)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    return res.json(sorted);
  } catch (err) {
    console.error("GET /income-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute income summary." });
  }
});

/**
 * GET /expense-summary
 * Monthly expenses from banks + cardusage with credit card billing cycle adjustment.
 * HSBC: day >= 20 -> next month, day < 20 -> same month
 * Alliance: day >= 3 -> same month, day <= 2 -> previous month
 * Others: same month
 */
router.get("/expense-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);

    const [banks, cardusage] = await Promise.all([
      fetchCollection(db, email, "banks"),
      fetchCollection(db, email, "cardusage"),
    ]);

    const monthlyExpense = {};

    // Bank expenses: negative amounts, excluding transfers
    for (const entry of banks) {
      const amount = toNum(entry.Amount || entry.amount);
      const category = (entry.Category || entry.category || "").toLowerCase();

      if (amount >= 0) continue;
      if (category.includes("transfer")) continue;

      const ym = toYearMonth(entry.Date || entry.date);
      if (!ym) continue;

      if (!monthlyExpense[ym]) monthlyExpense[ym] = 0;
      monthlyExpense[ym] += Math.abs(amount);
    }

    // Card usage with billing cycle adjustment
    for (const entry of cardusage) {
      const amount = toNum(entry.Amount || entry.amount);
      if (amount === 0) continue;

      const dateStr = entry.Date || entry.date;
      if (!dateStr) continue;

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      const day = d.getDate();
      let year = d.getFullYear();
      let month = d.getMonth(); // 0-indexed

      const cardName = (entry.Card || entry.card || entry.Name || entry.name || "").toUpperCase();

      if (cardName.includes("HSBC")) {
        // day >= 20 -> next month
        if (day >= 20) {
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }
      } else if (cardName.includes("ALLIANCE")) {
        // day <= 2 -> previous month
        if (day <= 2) {
          month -= 1;
          if (month < 0) {
            month = 11;
            year -= 1;
          }
        }
      }
      // Others: same month (no adjustment)

      const ym = `${year}-${String(month + 1).padStart(2, "0")}`;

      if (!monthlyExpense[ym]) monthlyExpense[ym] = 0;
      monthlyExpense[ym] += Math.abs(amount);
    }

    const sorted = Object.entries(monthlyExpense)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    return res.json(sorted);
  } catch (err) {
    console.error("GET /expense-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute expense summary." });
  }
});

/**
 * GET /card-summary
 * Monthly card usage grouped by card name and expense category.
 */
router.get("/card-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const cardusage = await fetchCollection(db, email, "cardusage");

    const summary = {};

    for (const entry of cardusage) {
      const amount = Math.abs(toNum(entry.Amount || entry.amount));
      if (amount === 0) continue;

      const ym = toYearMonth(entry.Date || entry.date);
      if (!ym) continue;

      const card = entry.Card || entry.card || entry.Name || entry.name || "Unknown";
      const category = entry.Category || entry.category || "Uncategorized";

      if (!summary[ym]) summary[ym] = {};
      if (!summary[ym][card]) summary[ym][card] = {};
      if (!summary[ym][card][category]) summary[ym][card][category] = 0;

      summary[ym][card][category] += amount;
    }

    // Flatten for response
    const result = [];
    for (const [month, cards] of Object.entries(summary)) {
      for (const [card, categories] of Object.entries(cards)) {
        for (const [category, total] of Object.entries(categories)) {
          result.push({ month, card, category, total });
        }
      }
    }

    result.sort((a, b) => a.month.localeCompare(b.month) || a.card.localeCompare(b.card));

    return res.json(result);
  } catch (err) {
    console.error("GET /card-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute card summary." });
  }
});

/**
 * GET /commitment
 * Returns commitment data grouped by month.
 */
router.get("/commitment", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const commitment = await fetchCollection(db, email, "commitment");

    const grouped = {};

    for (const entry of commitment) {
      const ym = toYearMonth(entry.Date || entry.date);
      const key = ym || "unspecified";

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }

    return res.json(grouped);
  } catch (err) {
    console.error("GET /commitment error:", err.message);
    return res.status(500).json({ error: "Failed to fetch commitment data." });
  }
});

module.exports = router;
