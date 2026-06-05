const express = require("express");
const { getFirestoreForUser } = require("../config/firebase");
const { getCollectionsForUser } = require("../config/collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

const USD_MYR_RATE = parseFloat(process.env.USD_MYR_RATE) || 4.5;

// --- Helpers ---
async function fetchCollection(db, email, collectionName) {
  const allowed = getCollectionsForUser(email);
  if (!allowed.includes(collectionName)) return [];
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function toDate(val) {
  if (!val) return null;
  if (val._seconds) return new Date(val._seconds * 1000); // Firestore Timestamp
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getMonthAbbr(monthIndex) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthIndex];
}

function toYearMonth(dateStr) {
  const d = toDate(dateStr);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * GET /wealth
 * Matches original Streamlit wealth calculation exactly per user.
 */
router.get("/wealth", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const usdRate = parseFloat(req.query.usdRate) || USD_MYR_RATE;

    const [banks, fd, epf, investment, share, insuranceinvestment, houseloaninfo, carloan, sspn] =
      await Promise.all([
        fetchCollection(db, email, "banks"),
        fetchCollection(db, email, "fd"),
        fetchCollection(db, email, "epf"),
        fetchCollection(db, email, "investment"),
        fetchCollection(db, email, "share"),
        fetchCollection(db, email, "insuranceinvestment"),
        fetchCollection(db, email, "houseloaninfo"),
        fetchCollection(db, email, "carloan"),
        fetchCollection(db, email, "sspn"),
      ]);

    if (email === "chengfai@hotmail.com") {
      // --- ChengFai wealth logic ---
      const KID_INVESTMENTS = ["Hin ASM3", "Yao ASM3"];
      const kidBankNames = ["Yao MBB", "Hin MBB"];

      const filteredBanks = banks.filter((b) => !kidBankNames.includes(b.Name));
      const kidBanks = banks.filter((b) => kidBankNames.includes(b.Name));
      const myInvestment = investment.filter((i) => !KID_INVESTMENTS.includes(i.Name));
      const kidInvestment = investment.filter((i) => KID_INVESTMENTS.includes(i.Name));
      const filteredInsInv = insuranceinvestment.filter((ii) => ii.Insurer === "Lum Cheng Fai");
      const filteredShare = share.filter((s) => s.Status === "On-hand");

      const totalBanks = filteredBanks.reduce((s, b) => s + toNum(b.Amount), 0);
      const totalFD = fd.reduce((s, f) => s + toNum(f.Amount), 0);
      const totalEPF = epf.reduce((s, e) => s + toNum(e.Amount), 0);
      const totalMyInvestment = myInvestment.reduce((s, i) => s + toNum(i["Current amount"]), 0);
      const totalInsInv = filteredInsInv.reduce((s, ii) => s + toNum(ii["Unit Price"]) * toNum(ii["Number of Units"]), 0);
      const totalShares = filteredShare.reduce((s, sh) => {
        const curr = (sh.Currency || "RM").toUpperCase();
        const amt = toNum(sh["Current Price"]) * toNum(sh.Share);
        return s + (curr === "USD" ? amt * usdRate : amt);
      }, 0);

      const totalWealth = totalBanks + totalFD + totalEPF + totalMyInvestment + totalInsInv + totalShares;

      // Kid wealth
      const totalKidBank = kidBanks.reduce((s, b) => s + toNum(b.Amount), 0);
      const totalSSPN = sspn.reduce((s, e) => s + toNum(e.Amount), 0);
      const totalKidInvestment = kidInvestment.reduce((s, i) => s + toNum(i["Current amount"]), 0);
      const totalKidWealth = totalKidBank + totalSSPN + totalKidInvestment;

      // Debt: house loan outstanding from houseloaninfo
      const totalHouseLoan = houseloaninfo
        .filter((h) => h.Description === "Outstanding Balance")
        .reduce((s, h) => s + toNum(h.Info), 0);

      // Car loan remaining balance calculation
      const carLoanTerms = {
        Serena: { term: 84, installment: 978 },
        CX30: { term: 60, installment: 2400 },
      };
      // Group car loan payments by name
      const carPayments = {};
      for (const cl of carloan) {
        const name = cl.Name;
        if (!carPayments[name]) carPayments[name] = 0;
        carPayments[name] += toNum(cl.Amount);
      }
      let totalCarLoan = 0;
      for (const [carName, totalPaid] of Object.entries(carPayments)) {
        const info = carLoanTerms[carName];
        if (info) {
          const monthsPaid = Math.floor(totalPaid / info.installment);
          const remainingMonths = Math.max(info.term - monthsPaid, 0);
          totalCarLoan += remainingMonths * info.installment;
        }
      }

      const totalDebt = totalHouseLoan + totalCarLoan;

      // Bank balances breakdown
      const myBankNames = ["MBB", "HSBC", "PBB", "HLB", "Ambank"];
      const myBankBalances = {};
      for (const name of myBankNames) {
        myBankBalances[name] = filteredBanks.filter((b) => b.Name === name).reduce((s, b) => s + toNum(b.Amount), 0);
      }
      const kidBankBalances = {};
      for (const name of kidBankNames) {
        kidBankBalances[name] = kidBanks.filter((b) => b.Name === name).reduce((s, b) => s + toNum(b.Amount), 0);
      }

      return res.json({
        totalWealth,
        totalKidWealth,
        totalDebt,
        netWealth: totalWealth - totalDebt,
        breakdown: [
          { category: "Bank", amount: totalBanks },
          { category: "FD", amount: totalFD },
          { category: "EPF", amount: totalEPF },
          { category: "Share", amount: totalShares },
          { category: "Insurance", amount: totalInsInv },
          { category: "Other Investment", amount: totalMyInvestment },
        ],
        kidBreakdown: [
          { category: "Bank", amount: totalKidBank },
          { category: "SSPN", amount: totalSSPN },
          { category: "ASM", amount: totalKidInvestment },
        ],
        debtBreakdown: [
          { category: "House", amount: totalHouseLoan },
          { category: "Car", amount: totalCarLoan },
        ],
        bankBalances: myBankBalances,
        kidBankBalances,
        usdMyrRate: usdRate,
      });
    } else if (email === "engseeaw@gmail.com") {
      // --- EngSee wealth logic ---
      const filteredBanks = banks.filter((b) => !["Yao MBB", "Hin MBB"].includes(b.Name));
      const filteredInsInv = insuranceinvestment.filter((ii) => ii.Insurer === "Aw Eng See");

      const totalBanks = filteredBanks.reduce((s, b) => s + toNum(b.Amount), 0);
      const totalFD = fd.reduce((s, f) => s + toNum(f.Amount), 0);
      const totalEPF = epf.reduce((s, e) => s + toNum(e.Amount), 0);
      const totalInsInv = filteredInsInv.reduce((s, ii) => s + toNum(ii["Unit Price"]) * toNum(ii["Number of Units"]), 0);
      const totalInvestment = investment.reduce((s, i) => s + toNum(i["Current amount"]), 0);

      const totalWealth = totalBanks + totalFD + totalEPF + totalInsInv + totalInvestment;

      const myBankNames = ["MBB", "PBB", "HLB (Old)", "HLB"];
      const myBankBalances = {};
      for (const name of myBankNames) {
        myBankBalances[name] = filteredBanks.filter((b) => b.Name === name).reduce((s, b) => s + toNum(b.Amount), 0);
      }

      return res.json({
        totalWealth,
        totalKidWealth: 0,
        totalDebt: 0,
        netWealth: totalWealth,
        breakdown: [
          { category: "Bank", amount: totalBanks },
          { category: "FD", amount: totalFD },
          { category: "EPF", amount: totalEPF },
          { category: "Insurance", amount: totalInsInv },
          { category: "Other Investment", amount: totalInvestment },
        ],
        kidBreakdown: [],
        debtBreakdown: [],
        bankBalances: myBankBalances,
        kidBankBalances: {},
        usdMyrRate: usdRate,
      });
    }

    return res.json({ totalWealth: 0, totalDebt: 0, breakdown: [] });
  } catch (err) {
    console.error("GET /wealth error:", err.message);
    return res.status(500).json({ error: "Failed to compute wealth summary." });
  }
});

/**
 * GET /income-summary
 * Monthly income from banks. Matches Streamlit:
 * - Amount > 0
 * - Exclude Expense Category in ["Balance", "Bank Transfer In", "Saving"]
 * - Exclude Name in ["Yao MBB", "Hin MBB"]
 * - Current year only
 * Returns grouped by month + category with transaction details.
 */
router.get("/income-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const banks = await fetchCollection(db, email, "banks");
    const currentYear = new Date().getFullYear();

    const excludeCategories = ["Balance", "Bank Transfer In", "Saving"];
    const excludeBanks = ["Yao MBB", "Hin MBB"];

    const incomeData = banks.filter((b) => {
      const amount = toNum(b.Amount);
      if (amount <= 0) return false;
      if (excludeCategories.includes(b["Expense Category"])) return false;
      if (excludeBanks.includes(b.Name)) return false;
      const d = toDate(b.Date);
      if (!d || d.getFullYear() !== currentYear) return false;
      return true;
    });

    // Group by month and category
    const monthly = {};
    const transactions = [];

    for (const entry of incomeData) {
      const d = toDate(entry.Date);
      const monthKey = getMonthAbbr(d.getMonth());
      const monthNum = d.getMonth() + 1;
      const category = entry["Expense Category"] || "Other";

      const key = `${monthKey}_${category}`;
      if (!monthly[key]) {
        monthly[key] = { month: monthKey, monthNum, category, amount: 0 };
      }
      monthly[key].amount += toNum(entry.Amount);

      transactions.push({
        date: d.toISOString().split("T")[0],
        bank: entry.Name,
        description: entry.Description,
        category,
        amount: toNum(entry.Amount),
      });
    }

    const grouped = Object.values(monthly).sort((a, b) => a.monthNum - b.monthNum);

    return res.json({ grouped, transactions });
  } catch (err) {
    console.error("GET /income-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute income summary." });
  }
});

/**
 * GET /expense-summary
 * Monthly expenses from banks + cardusage with billing cycle adjustment.
 * Matches Streamlit logic:
 * - Banks: Amount < 0, exclude user-specific categories, exclude kid banks
 * - Cardusage: current year, with HSBC/Alliance billing cycle adjustments
 */
router.get("/expense-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const currentYear = new Date().getFullYear();

    const [banks, cardusage] = await Promise.all([
      fetchCollection(db, email, "banks"),
      fetchCollection(db, email, "cardusage"),
    ]);

    // User-specific exclusions (matching Streamlit exactly)
    let bankExcludeCategories;
    if (email === "chengfai@hotmail.com") {
      bankExcludeCategories = ["Bank Transfer Out", "FD Placement", "Cash Withdrawal", "Credit Card Payment"];
    } else {
      bankExcludeCategories = ["Bank Transfer Out"];
    }
    const excludeBanks = ["Yao MBB", "Hin MBB"];

    // Bank expenses
    const bankExpenses = banks.filter((b) => {
      const amount = toNum(b.Amount);
      if (amount >= 0) return false;
      if (bankExcludeCategories.includes(b["Expense Category"])) return false;
      if (excludeBanks.includes(b.Name)) return false;
      const d = toDate(b.Date);
      if (!d || d.getFullYear() !== currentYear) return false;
      return true;
    });

    // Card expenses (current year)
    const cardExpenses = cardusage.filter((c) => {
      const d = toDate(c.Date);
      return d && d.getFullYear() === currentYear;
    });

    const monthly = {};
    const transactions = [];

    // Process bank expenses
    for (const entry of bankExpenses) {
      const d = toDate(entry.Date);
      const monthKey = getMonthAbbr(d.getMonth());
      const monthNum = d.getMonth() + 1;
      const category = entry["Expense Category"] || "Other";
      const amount = Math.abs(toNum(entry.Amount));

      const key = `${monthKey}_${category}`;
      if (!monthly[key]) monthly[key] = { month: monthKey, monthNum, category, amount: 0 };
      monthly[key].amount += amount;

      transactions.push({
        date: d.toISOString().split("T")[0],
        name: entry.Name,
        description: entry.Description,
        category,
        amount,
      });
    }

    // Process card expenses with billing cycle adjustment
    for (const entry of cardExpenses) {
      const d = toDate(entry.Date);
      const day = d.getDate();
      let adjustedMonth = d.getMonth();
      let adjustedYear = d.getFullYear();
      const cardName = (entry.Name || "").toUpperCase();

      if (cardName.includes("HSBC")) {
        if (day >= 20) {
          adjustedMonth += 1;
          if (adjustedMonth > 11) { adjustedMonth = 0; adjustedYear += 1; }
        }
      } else if (cardName.includes("ALLIANCE")) {
        if (day <= 2) {
          adjustedMonth -= 1;
          if (adjustedMonth < 0) { adjustedMonth = 11; adjustedYear -= 1; }
        }
      }

      const monthKey = getMonthAbbr(adjustedMonth);
      const monthNum = adjustedMonth + 1;
      const category = entry["Expense Category"] || "Other";
      const amount = Math.abs(toNum(entry.Amount));

      const key = `${monthKey}_${category}`;
      if (!monthly[key]) monthly[key] = { month: monthKey, monthNum, category, amount: 0 };
      monthly[key].amount += amount;

      transactions.push({
        date: d.toISOString().split("T")[0],
        name: entry.Name,
        description: entry.Description,
        category,
        amount,
      });
    }

    const grouped = Object.values(monthly).sort((a, b) => a.monthNum - b.monthNum);

    return res.json({ grouped, transactions });
  } catch (err) {
    console.error("GET /expense-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute expense summary." });
  }
});

/**
 * GET /card-summary
 * Card/eWallet usage with billing cycle adjustment.
 * Grouped by month and expense category. Current year only.
 */
router.get("/card-summary", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const cardusage = await fetchCollection(db, email, "cardusage");
    const currentYear = new Date().getFullYear();

    const result = [];

    const cardData = cardusage.filter((c) => {
      const d = toDate(c.Date);
      return d && d.getFullYear() === currentYear;
    });

    // Apply billing cycle adjustment
    for (const entry of cardData) {
      const d = toDate(entry.Date);
      const day = d.getDate();
      let adjustedMonth = d.getMonth();
      let adjustedYear = d.getFullYear();
      const cardName = (entry.Name || "").toUpperCase();

      if (cardName.includes("HSBC")) {
        if (day >= 20) {
          adjustedMonth += 1;
          if (adjustedMonth > 11) { adjustedMonth = 0; adjustedYear += 1; }
        }
      } else if (cardName.includes("ALLIANCE")) {
        if (day <= 2) {
          adjustedMonth -= 1;
          if (adjustedMonth < 0) { adjustedMonth = 11; adjustedYear -= 1; }
        }
      }

      result.push({
        month: getMonthAbbr(adjustedMonth),
        monthNum: adjustedMonth + 1,
        card: entry.Name,
        category: entry["Expense Category"] || "Other",
        amount: Math.abs(toNum(entry.Amount)),
        date: d.toISOString().split("T")[0],
        description: entry.Description,
      });
    }

    result.sort((a, b) => a.monthNum - b.monthNum);

    return res.json(result);
  } catch (err) {
    console.error("GET /card-summary error:", err.message);
    return res.status(500).json({ error: "Failed to compute card summary." });
  }
});

/**
 * GET /commitment
 * Returns commitment data grouped by month.
 * Uses the "Month" field (e.g., "Jan", "Feb") from commitment collection.
 */
router.get("/commitment", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const commitment = await fetchCollection(db, email, "commitment");

    const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const grouped = {};
    let grandTotal = 0;

    for (const entry of commitment) {
      const month = entry.Month || "Unknown";
      if (!grouped[month]) grouped[month] = { items: [], total: 0 };
      grouped[month].items.push(entry);
      grouped[month].total += toNum(entry.Amount);
      grandTotal += toNum(entry.Amount);
    }

    // Sort by month order
    const sorted = monthOrder
      .filter((m) => grouped[m])
      .map((m) => {
        // Sort items by Type, then Name, then Amount (matching Streamlit)
        grouped[m].items.sort((a, b) => {
          const typeCompare = (a.Type || '').localeCompare(b.Type || '');
          if (typeCompare !== 0) return typeCompare;
          const nameCompare = (a.Name || '').localeCompare(b.Name || '');
          if (nameCompare !== 0) return nameCompare;
          return toNum(a.Amount) - toNum(b.Amount);
        });
        return { month: m, ...grouped[m] };
      });

    return res.json({ months: sorted, grandTotal });
  } catch (err) {
    console.error("GET /commitment error:", err.message);
    return res.status(500).json({ error: "Failed to fetch commitment data." });
  }
});

/**
 * GET /monthly-expense
 * Budget vs Actual comparison for Monthly Expense page.
 * Matches Streamlit category mapping:
 *   Petrol -> ["Petrol"]
 *   Groceries -> ["Groceries"]
 *   Shopping -> ["Shopping", "Online Shopping"]
 *   Meal -> ["Food"]
 *   Transportation -> ["Toll", "Parking"]
 *
 * Also returns expense groups, salary, and balance calculation.
 */
router.get("/monthly-expense", async (req, res) => {
  try {
    const email = req.user.email;
    const db = getFirestoreForUser(email);
    const currentYear = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const currentMonth = req.query.month ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;

    const [banks, cardusage, expensesummary, commitment] = await Promise.all([
      fetchCollection(db, email, "banks"),
      fetchCollection(db, email, "cardusage"),
      fetchCollection(db, email, "expensesummary"),
      fetchCollection(db, email, "commitment"),
    ]);

    // Filter expensesummary for current year (if Date field exists, otherwise use all)
    const expSummary = expensesummary;

    // --- Budget vs Actual ---
    // Get current month bank expenses (absolute amounts)
    const bankExpenses = banks.filter((b) => {
      const d = toDate(b.Date);
      return d && d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    }).map((b) => ({
      category: b["Expense Category"],
      amount: Math.abs(toNum(b.Amount)),
    }));

    // Get current month card expenses
    const cardExpenses = cardusage.filter((c) => {
      const d = toDate(c.Date);
      return d && d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    }).map((c) => ({
      category: c["Expense Category"],
      amount: Math.abs(toNum(c.Amount)),
    }));

    const combinedExpenses = [...bankExpenses, ...cardExpenses];

    // Category mapping (Streamlit exact)
    const categoryMapping = {
      Petrol: ["Petrol"],
      Groceries: ["Groceries"],
      Shopping: ["Shopping", "Online Shopping"],
      Meal: ["Food"],
      Transportation: ["Toll", "Parking"],
    };

    const comparison = [];
    for (const [displayName, mappedCategories] of Object.entries(categoryMapping)) {
      const budgeted = Math.abs(
        expSummary.filter((e) => e.Category === displayName).reduce((s, e) => s + toNum(e.Amount), 0)
      );
      const actual = combinedExpenses
        .filter((e) => mappedCategories.includes(e.category))
        .reduce((s, e) => s + e.amount, 0);

      comparison.push({
        category: displayName,
        budgeted,
        actual,
        variance: budgeted - actual,
      });
    }

    // --- Salary & Gross Income ---
    const salary = expSummary.filter((e) => e.Category === "Salary").reduce((s, e) => s + toNum(e.Amount), 0);
    let grossIncome;
    if (email === "chengfai@hotmail.com") {
      grossIncome = salary * 0.69663715;
    } else if (email === "engseeaw@gmail.com") {
      grossIncome = salary * 0.86;
    } else {
      grossIncome = salary;
    }

    // --- Expense Groups ---
    const groupingRules = {
      Parents: ["Mum", "Dad"],
      School: ["School"],
      Family: ["Wife", "Hin Zai", "Mei Mei"],
      Bank: ["HLB", "PBB"],
      Installment: ["Installment"],
      Essentials: ["Mobile", "Petrol", "Groceries", "Shopping", "Online Shopping", "Food", "Meal", "Toll", "Parking", "Transportation"],
      Donation: ["World Vision", "Charity"],
      Others: [],
    };

    const uniqueCategories = [...new Set(expSummary.filter((e) => e.Category !== "Salary").map((e) => e.Category))];

    const groups = {};
    for (const groupName of Object.keys(groupingRules)) groups[groupName] = [];

    for (const cat of uniqueCategories) {
      let matched = false;
      for (const [group, keywords] of Object.entries(groupingRules)) {
        if (group === "Others") continue;
        if (keywords.some((kw) => cat.toLowerCase().includes(kw.toLowerCase()))) {
          groups[group].push(cat);
          matched = true;
          break;
        }
      }
      if (!matched) groups.Others.push(cat);
    }

    const expenseItems = [];
    for (const [group, categories] of Object.entries(groups)) {
      const items = categories.map((cat) => ({
        category: cat,
        amount: Math.abs(expSummary.filter((e) => e.Category === cat).reduce((s, e) => s + toNum(e.Amount), 0)),
      }));
      if (items.length > 0) {
        expenseItems.push({ group, items, total: items.reduce((s, i) => s + i.amount, 0) });
      }
    }

    const totalExpenses = expenseItems.reduce((s, g) => s + g.total, 0);
    const balance = grossIncome - totalExpenses;

    return res.json({
      comparison,
      salary,
      grossIncome,
      expenseGroups: expenseItems,
      totalExpenses,
      balance,
      currentMonth,
      currentYear,
    });
  } catch (err) {
    console.error("GET /monthly-expense error:", err.message);
    return res.status(500).json({ error: "Failed to compute monthly expense." });
  }
});

module.exports = router;
