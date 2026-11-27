EH GAMESHOP — FRESH MAIN BOT PACKAGE
===================================

এই ZIP একটি নতুন Main Bot Project-এর জন্য। এটি Development/Test entrypoint নয়।
Entry file: index.js
Run command: npm start
Telegram token secret: BOT_TOKEN
Admin secret: ADMIN_IDS
Mini App secret: WEB_APP_URL

গুরুত্বপূর্ণ
------------
1. এই প্যাকেজে পুরোনো customer/order/stock/reseller data অন্তর্ভুক্ত নেই।
2. ব্যবসার সব মূল ডেটা MongoDB Atlas-এ সংরক্ষিত হবে; স্থানীয় JSON ব্যবসার ডেটাবেস হিসেবে ব্যবহার হবে না।
3. পুরোনো data.json বা development-data.json import/migrate করা হয় না।
4. Customer bKash/Nagad/Rocket Transaction ID submission এবং Admin manual verification অন্তর্ভুক্ত। এটি automatic gateway/SMS verification নয়।
5. Free Fire Top-up হলো Admin-এর manual external purchase flow; Admin Purchase Completed করলে Customer notification যায়।
6. Reseller Auto Delivery, Manual Delivery, Due/Ledger, stock/profile, expiry reminder, reports, lifetime purchase summary ও Mini App এই source-এ অন্তর্ভুক্ত। Admin Mini App-এর Test Orders tab থেকে reseller নির্বাচন, product/quantity/price, Auto বা Manual delivery দিয়ে test চালানো যায়। Test order আলাদা TEST label-এ report activity ও reseller ledger-এ দেখা যায়; কিন্তু live sales, payable reseller due বা business totals-এ যোগ হয় না। Delete করলে test order, তার ledger এবং test-এর জন্য বরাদ্দ profile assignment পরিষ্কার হয়।
সতর্কতা — Existing Business Data
---------------------------------
- এই build একই `MONGODB_URI`, `MONGODB_DB` (default `eh_gameshop_fresh`), `app_state` collection এবং `_id=main` document ব্যবহার করলে ওই MongoDB snapshot load করবে; কোনো database drop/reset command নেই।
- আগের Replit project-এর business data যদি শুধু `data.json`-এ থাকে, এই package সেটি স্বয়ংক্রিয়ভাবে import করে না। সেক্ষেত্রে পুরোনো project replace করার আগে data migration প্রয়োজন। `data.json`, MongoDB বা production records কখনো backup ছাড়া delete/reset করবেন না।
- Existing production DB-এর `MONGODB_URI` / `MONGODB_DB` একই আছে কি না যাচাই না করে live project-এ upload করবেন না।

7. Customer Mini App-এ category browse, সব active paid subscription product-এর Buy Now, package/duration ও quantity selection, VPN-এর duration → VPN name → price selection, Free Fire package + Player UID, customer My Orders, manual bKash/Nagad/Rocket Transaction ID submission, Admin verification, account/profile assignment এবং Telegram delivery flow অন্তর্ভুক্ত। Payment automatic gateway/SMS নয়; Admin manual verification করবে। এই runtime-এ automated regression test করা হয়েছে, কিন্তু live Telegram/MongoDB/payment end-to-end test করা হয়নি।

REPLIT-এ নতুন করে বসানোর সহজ নিয়ম
--------------------------------
ধাপ ১ — নিরাপত্তা Backup
- Replit Main Project খুলুন।
- বর্তমান Project-এর একটি ZIP/Backup নিজের কাছে রাখুন, যদিও পুরোনো data আর ব্যবহার করবেন না।
- Secrets প্যানেলের screenshot/নোট রাখুন; Secret value কাউকে পাঠাবেন না।

ধাপ ২ — পুরোনো Project Files পরিষ্কার
- Replit Files panel-এ Project-এর পুরোনো source/data files নির্বাচন করে Delete করুন।
- বিশেষভাবে পুরোনো index.js, test-bot.js, পুরোনো data.json, development-data.json, old-test-state.json, পুরোনো Public/ ও lib/ ফাইল সরান।
- .env বা Secrets value কখনো ZIP-এ রাখবেন না। Replit Secrets প্যানেল আলাদা থাকে; সেটি Delete করবেন না।
- Replit-এর .git, .config বা platform-managed hidden folders থাকলে সেগুলো না বুঝে Delete করবেন না।

ধাপ ৩ — এই ZIP Upload/Extract
- ZIP ডাউনলোড করে Extract করুন।
- Extract করা ফোল্ডারের ভেতরের সব ফাইল Replit Project-এর root-এ Upload করুন।
- নিশ্চিত করুন index.js, package.json, .replit এবং Public/ সরাসরি root-এ আছে; অতিরিক্ত nested folder-এর ভেতরে নয়।

ধাপ ৪ — Secrets যাচাই
Replit → Tools → Secrets (বা Environment Variables)-এ:
- BOT_TOKEN: আপনার Main Bot-এর বর্তমান Telegram token
- ADMIN_IDS: আপনার Telegram Numeric ID (একাধিক হলে comma-separated)
- WEB_APP_URL: আপনার Replit-এর HTTPS URL শেষে /portal.html
আগের TEST_BOT_TOKEN ব্যবহার হবে না; BOT_TOKEN key থাকতে হবে। পেমেন্ট নম্বরের জন্য BKASH_NUMBER, NAGAD_NUMBER, ROCKET_NUMBER Secrets দিন। WEB_APP_URL এবং ADMIN_IDS-ও সঠিক হতে হবে। Token কখনো Chat-এ পাঠাবেন না।

ধাপ ৫ — MongoDB Atlas Secret
- Replit Secrets-এ MONGODB_URI নামে Atlas-এর Connect → Drivers থেকে পাওয়া URI দিন।
- URI-তে <password> অংশে Database User-এর password বসান; password-এ @, #, / ইত্যাদি থাকলে URL-encode করুন।
- MONGODB_DB নামে eh_gameshop_fresh দিন (ঐচ্ছিক; না দিলেও নতুন ডাটাবেসের এই নাম ব্যবহৃত হবে)।
- Atlas Network Access-এ Replit-এর outbound IP allowlist করতে হবে। Replit IP স্থির না হলে 0.0.0.0/0 ব্যবহার করলে যেকোনো IP থেকে connection অনুমোদিত হয়—শুধু শক্তিশালী Database User password ও least-privilege user ব্যবহার করুন।

ধাপ ৬ — Install ও Run
Shell-এ এই command দিন:
  npm install
  npm run check
  npm test
  npm start

অথবা Replit-এর Run চাপুন; .replit অনুযায়ী npm start চলবে।

ধাপ ৭ — Mini App URL
- Replit Deploy/Publish করে HTTPS URL নিন।
- WEB_APP_URL Secret-এ https://YOUR-APP.replit.app/portal.html সেট করুন।
- Secret পরিবর্তনের পর Repl Restart/Run করুন।
- Telegram-এ Main Bot-এ /start দিন; Mini App খুলে পরীক্ষা করুন।

নতুন Project-এ থাকবে
--------------------
index.js, package.json, .replit, .gitignore, .env.example,
README-MAIN-BOT-BN.txt, Public/, assets/, lib/, tests/,
reseller-system.js, eh-logo.png.

কখনো ZIP-এ BOT_TOKEN বা বাস্তব customer/account password রাখবেন না।


MONGODB STORAGE NOTE
--------------------
- This build stores the current app data snapshot in MongoDB database/collection: eh_gameshop_fresh.app_state (document _id=main).
- This is a simple migration for the current app and is suitable for initial testing/small data volumes; MongoDB document size is limited to 16 MB. Larger scale should split orders, stock, customers and ledger into separate collections.
- MongoDB Atlas Free is not a backup/production SLA. Export regular backups and test restore before real business. Never share MONGODB_URI.
- Existing local JSON files are deliberately NOT imported. Fresh database starts clean.


নতুন আপডেট — Account & Profile Reminder Dashboard
--------------------------------------------------
- Admin Mini App-এ “Account & Profiles” ট্যাব যোগ হয়েছে।
- Reminder-only Account আলাদা করে Add করা যাবে: Amazon Prime (সর্বোচ্চ ৬ Profile) এবং Crunchyroll (সর্বোচ্চ ৫ Profile)।
- প্রতিটি Account-এর Email/ID, Password এবং Original Expiry Date থাকবে।
- Account-এর ভেতর থেকেই Profile link করা যাবে; Stock ID প্রয়োজন নেই।
- Profile-এর Customer Name, Telegram ID এবং Extra Days দেওয়া যাবে। Customer Expiry স্বয়ংক্রিয়ভাবে Original Account Expiry + Extra Days হবে।
- Account-এর মেয়াদ শেষ হওয়ার ১ দিন আগে এবং Expiry Date-এ Admin Telegram-এ Reminder যাবে; Reminder-এ Account credentials ও linked profile/customer expiry/extra days থাকবে।
- Account Expiry বা credentials update করা যাবে; Expiry বদলালে linked customer expiry পুনরায় হিসাব হবে।
- Reminder-only Account/Profile আলাদা MongoDB collection document payload-এ থাকে; এগুলো sellable Stock, Order, Payment, Sales বা Ledger-এ যোগ হয় না।
- Profile unlink করলে record history-তে থাকে, কিন্তু active slot থেকে বাদ যায়।
- /start পুরোনো Telegram Reply Keyboard সরিয়ে নতুন persistent menu পাঠায়। Admin menu-তে Stock Center, Account & Profiles, Orders/Reports এবং Storefront shortcut রয়েছে।

গুরুত্বপূর্ণ:
- Account & Profile Dashboard খুলতে Replit Secret WEB_APP_URL-এ Telegram Mini App-এর public URL সেট থাকতে হবে।
- Telegram Bot ও scheduled reminders চালু রাখতে Replit deployment running থাকতে হবে।
- এই আপডেটে Account/Profile Reminder ও Menu যোগ করা হয়েছে। Customer storefront এখন active paid subscription products-এর Buy Now checkout, category filter, package/duration variants, quantity, VPN duration/provider selection, Free Fire UID top-up, My Orders এবং manual payment submission সমর্থন করে। Admin payment verify করে stock profile assign এবং Deliver to Customer action ব্যবহার করবে।


NEW STOCK LIFECYCLE + PREVIEW CUSTOMIZATION (Nov 2026)
====================================================
- Stock entry now asks only for Product, Email/Account ID, Password, Original Account Expiry and Price. No Activation Date is collected.
- Every purchase starts a separate customer validity period from successful delivery (30 days in the current automatic reseller flow). Extra Days are calculated as Customer Expiry minus Original Account Expiry; zero/negative differences are not shown as extra.
- Expired profile slots can be reused for a new customer after their previous Customer Expiry. The previous customer assignment is retained in that profile's history.
- When the account's Original Expiry has passed and no customer profile is still running, the stock cycle is automatically archived and hidden from new reseller allocation. It remains in Stock Lifecycle history.
- A new subscription cycle gets a new Stock ID. Use Stock Center > Account Update > Renew Subscription, or Admin Dashboard > Stock Lifecycle > Create New Stock Cycle. The previous Stock ID and its sales/profile history remain unchanged.
- Running customers can be moved to a replacement profile from Admin Dashboard > Stock Lifecycle > Give Replacement. The remaining Customer Expiry is preserved; replacement and original profile links are recorded.
- Preview layouts are editable in Admin Dashboard > Preview Templates. Edit/paste JSON or upload a JSON file, then Save JSON Templates. The configuration is saved in MongoDB, so no ZIP upload or Replit republish is required for future layout-only changes.
- Editable preview keys: customer_delivery, reseller_delivery, reminder, report. Each supports parse_mode (HTML/Markdown/MarkdownV2), text, and inline keyboard button rows. Supported button actions: callback_data, url, copy_text. Telegram does not support native HTML <table>; use Unicode box-drawing characters for table-like alignment.
- Example starter JSON is in config/preview-templates.json. The Admin Preview Templates tab can also restore the built-in defaults.

---

## Reseller Due Clearance Verification (Updated)

Resellers cannot clear their own due. After making a payment, a reseller submits a Due Clearance Request with the amount, payment method and Transaction ID. The request stays Pending and the outstanding due does not change until an Admin verifies the payment in the receiving account and presses Confirm Payment. Admin can Reject a request; rejected requests do not change the ledger. Partial and full payments are supported. Transaction IDs are checked for duplicates and a confirmed payment is recorded as a ledger credit with its request ID and confirming Admin.

The same workflow is available from the Telegram `/reseller` menu and the Mini App's Due / Ledger section. Admin requests are available in the Mini App's Due Clearance Requests tab and via Telegram notification buttons.

## Short Date Input

Date fields accept short day-month inputs such as `4.11`, `4-11`, `4/11`, or `4 11` without a year. The system uses the current Asia/Dhaka year when the date is today or upcoming; if that date has already passed in the current year, it uses the next year's occurrence. Full dates remain accepted too. Ambiguous slash formats with a year are interpreted as DD/MM/YYYY.

## Telegram Native Rich Message Templates

Preview Studio accepts JSON, HTML/HTM, TXT, or pasted template text. Raw HTML is imported as Telegram Rich HTML; plain text is imported as a regular message; JSON can define a regular template or `format: "rich_html"` / `format: "rich_markdown"`. Rich templates are sent using Telegram Bot API `sendRichMessage`, which supports native tables, headings, lists, dividers and embedded rich-message buttons on supported Telegram clients. Regular templates continue to use normal Telegram messages. Templates are saved in MongoDB; changing them does not require a ZIP upload or Replit republish.

## Mini App Menu Button

On startup, if `WEB_APP_URL` is configured, the bot attempts to set Telegram's persistent Menu Button to open the EH Gameshop Mini App. `/start` also provides the visible Open EH Gameshop button. The URL must be the public HTTPS URL of this deployed Mini App.

SECTION 3 — RESELLER SYSTEM UPDATE
- Reseller Mini App supports a multi-product cart (up to 20 items total) using active catalogue products; if no catalogue records exist, the current stock product list is used as a fallback.
- Every cart creates one parent order, a unique item ID per product quantity, and one combined reseller-due ledger debit.
- Reseller credit checkout is blocked until Admin explicitly authorizes that reseller. No fixed credit limit is imposed.
- Admin Mini App includes Reseller Pricing (Rate 1/2/3, per-tier product prices, reseller-specific special prices, and credit authorization) and Reseller Customer Lookup (orders, item history, linked profile history).
- Auto allocation uses FEFO (earliest original account expiry first). Customer subscription expiry starts only after successful Telegram delivery and uses the selected product duration (30 days when no duration is configured).
- Failed delivery releases the reserved profile. Retry only processes pending/awaiting items; already completed or rejected items are not sent again.
- Each new reseller cart gets a 30-minute delivery target/deadline. The system checks every minute and alerts Admin and the reseller if pending items remain after the deadline. This is an SLA alert, not a guarantee that stock or Telegram delivery can never fail.
- Existing MongoDB data is not reset by these changes. Keep the existing MongoDB connection and database state.

VALIDATION
- `npm run check` passed.
- Portal embedded JavaScript syntax check passed.
- `npm test` passed: 42 tests.
- Live Replit deployment, MongoDB production write, and Telegram end-to-end delivery were not performed in this workspace.


SECTION 4 — CUSTOMER & SUBSCRIPTION MANAGEMENT
- Admin Mini App tab: Customers & Subscriptions.
- Add, search, view and edit customer records by Telegram ID.
- View each customer's order history and active linked subscriptions.
- Link/unlink stock profiles without creating a sale or payment entry.
- Renew by adding days or setting a later explicit customer expiry date.
- Replacement keeps the existing customer expiry; only extra days against the new account expiry are recalculated.
- Renewal and replacement events are retained in subscription history.
- Admin can send a Telegram subscription update to a customer (the customer must have opened the bot first).
- Customer expiry is separate from original stock/account expiry. No MongoDB reset or data deletion is performed.


SECTION 5 — YOUTUBE PREMIUM SPECIAL REQUESTS
---------------------------------------------
- Customer/Reseller Mini App supports YouTube Family Invite requests with 1–10 email addresses. Each email becomes its own independently tracked item with a unique item ID and status. Duplicate or invalid email addresses are rejected.
- Individual YouTube requests accept one email address and optional non-sensitive notes. The form and API do not request or store Google passwords, backup codes, or login credentials.
- Admin Mini App YouTube Requests displays every email item separately. Admin manually sends the Family invitation through Google Family; after sending, Admin can mark that item as Invited, then Completed when appropriate. No automated Google account login/invitation integration is included.
- Admin can update each item's status independently. Each item has exactly one replacement allowance; the replacement email, previous email, reason, Admin and timestamp are retained in history. Further replacement attempts are blocked.
- Customer My Requests displays parent request and per-email item status/replacement availability. Status/replacement updates send Telegram notifications when the customer has started the bot.
- Existing legacy YouTube request records are migrated on MongoDB load into item-based records. Legacy YouTube password, OCR text and screenshot attachment references are removed from the stored request records, and the cleaned snapshot is saved.
- YouTube request data remains in the existing MongoDB app_state document. No other business records are reset.

SECTION 5 VALIDATION
- `npm run check` passed, including YouTube request module syntax.
- Mini App embedded JavaScript syntax check passed.
- `npm test` passed: 52 tests (6 new YouTube request tests).
- Live Replit deployment, production MongoDB migration and Telegram end-to-end tests were not performed in this workspace.


SECTION 6 — ACCOUNT EXPIRY & MAINTENANCE
- Customer subscription reminders run automatically every 30 minutes using Asia/Dhaka dates.
- Reminder schedule: 7 days, 3 days, 1 day, and the expiry date. Each reminder is sent once per customer expiry date and schedule point; failed Telegram sends remain retryable.
- Customer reminders contain product, profile, and customer expiry only; no account password or private stock credentials are sent.
- Admin Mini App tab: Expiry & Maintenance. It lists expired, due-today, 1–3 day, 4–7 day, and active subscriptions, reminder history, and a manual Send Reminder Now action.
- Renewals continue to support Add Days and Set New Expiry Date. Renewal now resets reminder markers and automatically sends the customer a renewal confirmation. If the customer has not started the bot or Telegram delivery fails, renewal remains saved and the Admin UI reports the notification failure so it can be sent manually.
- Existing Admin customer notification and subscription history remain available. All reminder tracking is stored with the profile in the existing MongoDB app_state document; no database reset or new paid service is required.

SECTION 7 — ORDER & SUPPORT MANAGEMENT
- Admin Order Management Mini App tab: search orders by order/customer/product/status, review payment state, verify or reject submitted payment, assign matching account profiles, deliver each assigned item, update valid item status, and complete verified Free Fire top-ups.
- Customer and reseller My Orders shows order/item status, payment status, reseller 30-minute SLA, delivery timestamps, and safe activity history. Credentials and stock-internal IDs remain hidden from customer order APIs.
- Order activity history records payment decisions, item assignment, item status changes, and successful delivery with actor and timestamp.
- Support Center lets customers/resellers create tickets with optional JPG/PNG/WEBP screenshot (max 3MB), view their own ticket threads, and reply.
- Admin Support Tickets supports Open/Hold/Resolved filters, threaded replies, status history, screenshot access, and Telegram notifications to the customer/admins. Customer replies reopen non-resolved tickets; resolved tickets cannot be replied to by customers.
- Ticket access is restricted to its owner or an authenticated admin. Attachments are served through owner-checked or admin-only endpoints.
- No database reset or live deployment is performed by this source update.


SECTION 8 — MINI APP DESIGN & SYSTEM MAINTENANCE
================================================
- Rebuilt the Mini App presentation in a responsive Premium Light layout with a clean brand header, trust-focused hero, horizontal navigation, refined cards, form controls, spacing and mobile/desktop breakpoints.
- Added a product catalogue view with product marks/logos, category, package, description, price and Buy Now checkout buttons. Customers can browse categories, select subscription package variants and quantity, and submit manual payment. VPN selection follows duration → VPN name → price. Free Fire Top-up has Weekly ৳155 and Monthly ৳760 starter packages plus Player UID input.
- Product logos are served from /assets. Existing YouTube Premium, Amazon Prime and Crunchyroll image assets are retained; matching custom vector marks are included for Netflix, VPN, Canva Pro, Duolingo, Spotify and Free Fire.
- Added Admin Product Catalogue Studio: create, edit, activate/deactivate and archive products. Archive is soft-delete and preserves historical orders. A starter catalogue can be added once; review/configure prices before selling.
- Added Brand & Experience Studio: editable brand name, tagline, accent colour, font, button shape, density and uploaded PNG/JPG/WEBP logo (450 KB max). Settings are persisted in the existing MongoDB app_state document and applied to all Mini App visitors.
- Added read-only System Health page showing MongoDB connection, Node runtime, uptime and business-record counts. No reset/clear operation was introduced.
- Repaired Mini App tab references that previously pointed to missing handlers; customer/reseller Shop, Free Fire Top-up, Admin Stock Lifecycle, daily/monthly report and lifetime purchase views now have handlers in the portal script.
- Public catalogue and brand settings expose presentation data only. Admin product/brand writes require validated Telegram Web App authentication. Product logos are restricted to bundled assets; product archive never deletes historical data.
- MongoDB migration is additive: settings are stored under data.settings.portal and product catalogue entries under data.products. Existing orders, stock, profiles, customers, subscriptions, reseller ledger and tickets are not reset.


CUSTOMER CHECKOUT & MANUAL PAYMENT UPDATE (Nov 2026)
==================================================
- Customer subscription purchases now create random, non-sequential EHG-XXXXXXXX order IDs and individual order-item IDs.
- Each subscription order uses the current server-side catalogue price; client-submitted prices are never trusted. Quantity is limited to 1–10 per order.
- Product package variants are configured as separate active catalogue entries with the same product name and distinct Package / Duration values. The customer selects the variant at checkout.
- VPN catalogue entries should use Category “Privacy & VPN”, Product Name as the VPN provider name, Package / Duration as 3 Days / 7 Days / 30 Days, and the configured price. The Mini App asks for duration first, then VPN name.
- Free Fire starter packages are Weekly Membership ৳155 and Monthly Membership ৳760. Customers must enter their Player UID. Admin marks the external top-up purchased only after payment verification.
- Manual customer payment supports bKash, Nagad and Rocket Send Money. Customer submits the Transaction ID from My Orders; duplicate Transaction IDs are blocked; Admin verifies or rejects the payment. No automatic SMS/payment gateway is included.
- After verified payment, Admin Order Management can assign a matching stock profile and deliver account details to the customer through Telegram. Amazon Prime/Prime, YouTube Premium/YouTube and VPN product aliases are matched for stock assignment.
- Run `npm run check` and `npm test` before deployment. This package has not been live-tested against the user's production Telegram bot or MongoDB instance.


FRESH DATABASE SAFETY (IMPORTANT)
- This build defaults to MongoDB database `eh_gameshop_fresh` so the previous test stock/products/orders are not loaded. In Replit Secrets, explicitly set `MONGODB_DB=eh_gameshop_fresh` before first start. If an old `MONGODB_DB=eh_gameshop` secret remains, it overrides the default and old data will load.
- The old database is not deleted or modified. Keep it as a backup; do not drop it.
- New order IDs use random `EHG-` identifiers, not sequential counters, so they do not reveal order volume. Search works by the full ID.
- Test orders are visible in the dedicated Admin Test Orders screen and separately labelled in reseller ledger/report test activity; they do not affect real sales totals or payable due. Delete removes the test order and linked test ledger and releases test-assigned stock profiles.


NOV 2026 — CENTRAL PREVIEW STUDIO & RESELLER PRIVACY UPDATE
===========================================================
- Preview Studio now has one-at-a-time Telegram preview testing for Stock Management layouts and reseller/admin/customer message types. Use sample fixtures only; no real reseller/customer/order/stock records are created or changed.
- Save & Send to My Telegram sends only to the authenticated Admin who requested the preview. It no longer broadcasts preview tests to every ADMIN_IDS entry.
- Stock Management layout options: Original Table, Compact Table, Expanded Rows, and Hybrid Table. These are separate templates and can be tested one at a time. The expanded-row version is a static Rich Message layout; it is not a native collapsible row control.
- Reseller preview fixtures work even when no real reseller account has been registered. The stored Telegram numeric ID remains the authentication key, while the visible Reseller ID is R-<Telegram User ID>; the duplicate Telegram UID line is removed from reseller profile/directory messages.
- Customer and reseller delivery messages do not expose Extra Days. Extra Days remains internal stock/accounting data and is available only in Admin-only stock/reminder management views and Admin previews; non-Admin API projections omit it.
- Reseller delivery uses the customer-equivalent account delivery presentation (brand, product/package, account details, customer expiry and safe copy information).
- New order IDs use EHG- plus 8 random uppercase alphanumeric characters with collision checking. Existing historical IDs remain unchanged.
- Future template layout edits can be pasted/uploaded as JSON, HTML, HTM or TXT and saved to MongoDB without another ZIP upload or redeploy. Initial code changes still require this ZIP update and deployment.


PREVIEW COVERAGE & PRIVATE FIELD RULES — NOV 2026
================================================
- Preview coverage includes Customer Delivery, Reseller Delivery, Expiry Reminder, Business Report, Stock Account Details, four Stock Management table layouts, Reseller Directory, Reseller Profile/Greeting, Dashboard, Shop, Order Details, Due/Ledger, Due Clearance Request, My Profiles, Order Search, YouTube Request, Support Ticket, Admin Reseller Pricing, Admin Due Review and Admin Order Review.
- The Telegram bot Stock Account Rich Message has a PREVIEW LAYOUTS action. It opens a one-at-a-time layout picker and edits the same message for the selected sample layout. Sample EDIT/DELETE buttons only show a preview-only alert and never mutate stock.
- The Telegram Reseller Directory has a PREVIEW RESELLER PROFILE action that opens the demo profile in the same message and offers a Back action.
- Mini App sections with contextual preview controls include Stock Management, Reseller Pricing / Preview Lab, Reseller Customer Lookup, Admin Orders, Reports, Support Tickets and Due Clearance Requests.
- The Preview Studio reuses one Admin Telegram preview message when possible. If Telegram cannot edit the message type, it attempts to delete the previous preview before sending the replacement. A bot restart may reset the in-memory message reference.
- Reseller sample fixtures do not require a real reseller account and never create one. They use demo data such as `R-123456789`.
- Extra Days is removed from Customer/Reseller delivery templates and from non-Admin `/api/me/profiles`, `/api/me/orders`, `/api/order-search`, and Reseller order API projections. The underlying stock profile field is retained for Admin accounting.
- Reseller ID is displayed as `R-<Telegram User ID>` in reseller-facing/admin-facing labels. The numeric Telegram ID remains the internal database/authentication key; the duplicate Telegram UID row is removed from Reseller Profile/Greeting and Reseller Directory.
- New order IDs are `EHG-` + 8 random uppercase alphanumeric characters. The code checks for collisions against existing orders; historical IDs are not rewritten.


UPDATE v1.2.4 — Telegram Delivery & Reminder Corrections
=========================================================
- Reseller Auto Delivery recipient variable fixed; normalized product matching and FEFO stock priority preserved.
- Admin Stock Account expiry reminders: 7, 3, 1 days before and on expiry date; Rich Message table format.
- Telegram Reseller Shop: four consistent buttons (Amazon Prime, 🍿 Crunchyroll, YouTube Premium, VPN).
- Telegram YouTube Family Invite quantity selector (1–10), email list submission, Individual email request, Admin /youtube status controls, Hold status and reseller status history.
- Validation: npm run check passed; npm test passed 176/176. Live Telegram/MongoDB deployment not performed.

Delivery Preview Animation Test (v1.2.13)
- Admin can send /deliverydemo in the Telegram bot chat to preview the five-stage delivery loading sequence and then the Reference-Based Delivery Preview.
- This is a sample-only preview; it does not create an order, reserve stock, or change customer data.
