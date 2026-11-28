const VALID_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ITEM_STATUSES = ["Pending Review", "Accepted", "Processing", "Hold", "Completed", "Cancelled"];
// Legacy values saved by older versions. "Invited" meant the same as "Completed" in this workflow
// and "Rejected" is now called "Cancelled". They are converted on load and history is kept.
const LEGACY_STATUS_MAP = { Invited: "Completed", Rejected: "Cancelled" };
function normalizeLegacyStatus(status) {
  const value = String(status || "");
  return Object.prototype.hasOwnProperty.call(LEGACY_STATUS_MAP, value) ? LEGACY_STATUS_MAP[value] : value;
}

function createYoutubeItems({ type, emails, email, notes = "", now = new Date().toISOString(), idPrefix = `YTI-${Date.now()}` }) {
  if (!["family", "individual"].includes(type)) throw new Error("Invalid request type");
  if (type === "family") {
    const list = Array.isArray(emails) ? emails.map(x => String(x).trim().toLowerCase()).filter(Boolean) : [];
    if (list.length < 1 || list.length > 10 || list.some(x => !VALID_EMAIL.test(x))) throw new Error("Family request requires 1–10 valid email addresses");
    if (new Set(list).size !== list.length) throw new Error("Duplicate email addresses are not allowed");
    return list.map((address, i) => ({ id: `${idPrefix}-${i + 1}`, email: address, notes: "", status: "Pending Review", replacementCount: 0, history: [], createdAt: now }));
  }
  const address = String(email || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(address)) throw new Error("Enter a valid email address");
  return [{ id: `${idPrefix}-1`, email: address, notes: String(notes || "").trim().slice(0, 1000), status: "Pending Review", replacementCount: 0, history: [], createdAt: now }];
}

function migrateYoutubeRequests(requests) {
  const rows = Array.isArray(requests) ? requests : [];
  for (const req of rows) {
    if (!Array.isArray(req.items)) {
      const emails = req.type === "family" ? (req.payload?.emails || []) : [req.payload?.email].filter(Boolean);
      req.items = emails.map((email, i) => ({ id: `${req.id}-ITEM-${i + 1}`, email: String(email).toLowerCase(), notes: req.type === "individual" ? String(req.payload?.notes || "") : "", status: req.status || "Pending Review", replacementCount: 0, history: [], createdAt: req.createdAt || new Date().toISOString() }));
    }
    for (const item of req.items) {
      const mapped = normalizeLegacyStatus(item.status);
      if (mapped !== item.status && item.status) {
        const now = new Date().toISOString();
        item.history = Array.isArray(item.history) ? item.history : [];
        item.history.push({ action: "STATUS_MIGRATION", status: mapped, from: item.status, at: now, by: "system" });
        item.status = mapped;
      }
      item.replacementCount = Math.min(1, Math.max(0, Number(item.replacementCount || 0)));
      item.history = Array.isArray(item.history) ? item.history : [];
      delete item.password; delete item.googlePassword; delete item.backupCode;
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_MAP, String(req.status || ""))) req.status = normalizeLegacyStatus(req.status);
    if (req.payload) delete req.payload.password;
    delete req.payload; delete req.ocrText; delete req.ocrAvailable; delete req.attachment;
  }
  return rows;
}

function updateYoutubeItemStatus(item, status, by, now = new Date().toISOString()) {
  status = status === "Rejected" ? "Cancelled" : status;
  if (!ITEM_STATUSES.includes(status)) throw new Error("Invalid status");
  item.status = status; item.updatedAt = now; item.history ||= [];
  item.history.push({ action: "STATUS", status, at: now, by: String(by) });
  return item;
}

function replaceYoutubeItem(item, newEmail, reason = "", by, now = new Date().toISOString()) {
  if (Number(item.replacementCount || 0) >= 1) throw new Error("One replacement has already been used for this email item");
  const next = String(newEmail || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(next)) throw new Error("Enter a valid replacement email");
  const oldEmail = item.email;
  item.email = next; item.replacementCount = 1; item.replacedAt = now;
  item.replacementReason = String(reason || "").trim().slice(0, 500); item.status = "Pending Review";
  item.history ||= [];
  item.history.push({ action: "REPLACEMENT", oldEmail, newEmail: next, reason: item.replacementReason, at: now, by: String(by) });
  return item;
}

module.exports = { VALID_EMAIL, ITEM_STATUSES, LEGACY_STATUS_MAP, normalizeLegacyStatus, createYoutubeItems, migrateYoutubeRequests, updateYoutubeItemStatus, replaceYoutubeItem };
