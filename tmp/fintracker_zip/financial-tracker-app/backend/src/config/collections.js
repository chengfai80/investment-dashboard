/**
 * Collection field schemas per user, mirroring the Streamlit app exactly.
 * Each key is a collection name; each value is an array of field names.
 */

const COMMON_COLLECTIONS = ["accounts", "transaction_templates"];

const COLLECTION_FIELDS = {
  "chengfai@hotmail.com": {
    banks: ["Date", "Name", "Type", "Description", "Expense Category", "Amount"],
    cardusage: ["Date", "Name", "Type", "Description", "Expense Category", "Amount"],
    carloan: ["Date", "Name", "Type", "Amount"],
    category: ["Category", "Type"],
    commitment: ["Month", "Name", "Type", "Description", "Amount"],
    epf: ["Account Type", "Amount", "Name", "Type"],
    expensesummary: ["Category", "Amount"],
    fd: ["Date", "Name", "Type", "Interest", "Term", "Amount", "Maturity Date"],
    houseloan: ["Date", "Description", "Amount"],
    houseloaninfo: ["Description", "Info"],
    insurance: ["Insurer", "Company", "Date", "Premium End Date", "Coverage End Date", "Policy No", "Annual Premium", "Death", "TPD", "Critical Illness (45)", "Early CI Payout", "Early Cancer", "Personal Accident", "Medical", "Nominee"],
    insuranceinvestment: ["Insurer", "Name", "Type", "Policy Number", "Fund", "Number of Units", "Unit Price"],
    investment: ["Type", "Name", "Investment", "Original amount", "Current amount", "Start Date"],
    share: ["Type", "Name", "Currency", "Stock Name", "Buy Price", "Current Price", "Share", "Status"],
    sspn: ["Name", "Type", "Date", "Activity", "Amount"],
  },
  "engseeaw@gmail.com": {
    banks: ["Date", "Name", "Type", "Description", "Expense Category", "Amount"],
    cardusage: ["Date", "Name", "Type", "Description", "Expense Category", "Amount"],
    category: ["Category", "Type"],
    commitment: ["Month", "Name", "Type", "Description", "Amount"],
    epf: ["Account Type", "Amount", "Name", "Type"],
    expensesummary: ["Category", "Amount"],
    fd: ["Date", "Name", "Type", "Interest", "Term", "Amount"],
    insurance: ["Insurer", "Company", "Date", "Premium End Date", "Coverage End Date", "Policy No", "Annual Premium", "Death", "TPD", "Critical Illness (45)", "Early CI Payout", "Early Cancer", "Personal Accident", "Medical", "Nominee"],
    insuranceinvestment: ["Insurer", "Name", "Type", "Policy Number", "Fund", "Number of Units", "Unit Price"],
    investment: ["Type", "Name", "Investment", "Original amount", "Current amount", "Start Date"],
  },
};

// Attach common collections to each user
for (const email of Object.keys(COLLECTION_FIELDS)) {
  for (const col of COMMON_COLLECTIONS) {
    COLLECTION_FIELDS[email][col] = [];
  }
}

/**
 * Returns the list of collection names available for a given user.
 */
function getCollectionsForUser(email) {
  const fields = COLLECTION_FIELDS[email];
  if (!fields) {
    throw new Error(`No collections configured for user: ${email}`);
  }
  return Object.keys(fields);
}

/**
 * Returns the field names for a given user + collection.
 */
function getFieldsForCollection(email, collectionName) {
  const fields = COLLECTION_FIELDS[email];
  if (!fields || !fields[collectionName]) return [];
  return fields[collectionName];
}

module.exports = { COLLECTION_FIELDS, COMMON_COLLECTIONS, getCollectionsForUser, getFieldsForCollection };
