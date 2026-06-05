/**
 * Collection field schemas per user, mirroring the Streamlit app.
 * Each key is a collection name; each value is an array of field names.
 *
 * Both users also have: accounts, transaction_templates
 */

const COMMON_COLLECTIONS = ["accounts", "transaction_templates"];

const COLLECTION_FIELDS = {
  "chengfai@hotmail.com": {
    banks: [],
    cardusage: [],
    carloan: [],
    category: [],
    commitment: [],
    epf: [],
    expensesummary: [],
    fd: [],
    houseloan: [],
    houseloaninfo: [],
    insurance: [],
    insuranceinvestment: [],
    investment: [],
    share: [],
    sspn: [],
  },
  "engseeaw@gmail.com": {
    banks: [],
    cardusage: [],
    category: [],
    commitment: [],
    epf: [],
    expensesummary: [],
    fd: [],
    insurance: [],
    insuranceinvestment: [],
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
 * @param {string} email
 * @returns {string[]}
 */
function getCollectionsForUser(email) {
  const fields = COLLECTION_FIELDS[email];
  if (!fields) {
    throw new Error(`No collections configured for user: ${email}`);
  }
  return Object.keys(fields);
}

module.exports = { COLLECTION_FIELDS, COMMON_COLLECTIONS, getCollectionsForUser };
