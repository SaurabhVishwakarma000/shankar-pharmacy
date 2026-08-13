# Backend

## Stage 1 - Skeleton
- Express app (`src/app.js`) - exports the app only, no side effects
- `src/server.js` - connects to MongoDB and starts listening (run this to boot the server)
- MongoDB connection module (`src/config/db.js`) - connects on startup,
  logs success/failure, does NOT crash the server if the DB is unreachable
- `GET /api/health` - reports server status and DB connection status separately
- Centralized 404 handler and error handler

## Stage 2 - Medicine model + public API
- `src/models/Medicine.js` - Mongoose schema, scoped by `pharmacyId` (no
  Shankar-Pharmacy-specific data in the schema itself)
- `src/routes/medicines.routes.js` + `src/controllers/medicines.controller.js`
  - `GET /api/medicines?search=<query>` - case-insensitive partial-name search
  - `GET /api/medicines/:id` - single medicine
- `src/validators/medicine.validator.js` - Joi validation for query params and ids
- `src/middleware/requireDB.js` - returns a clean 503 if MongoDB isn't connected,
  instead of hanging or crashing
- `src/middleware/asyncHandler.js` - forwards async errors to the central error handler
- `seed/seed.js` - the ONLY place Shankar Pharmacy's demo medicine data lives

## Stage 3 - Admin authentication
- `src/models/Admin.js` - scoped by `pharmacyId`; `passwordHash` excluded
  from queries by default (`select: false`) and stripped from any JSON
  response as a second safeguard
- `src/config/auth.js` - single source of truth for JWT signing/verification
  and httpOnly cookie options
- `src/middleware/auth.middleware.js` - `requireAuth` (valid session) and
  `requireAdmin` (role check) - kept as separate checks so future roles
  can reuse `requireAuth` alone
- `src/middleware/validate.js` - generic Joi validation middleware, runs
  before DB-dependent middleware so validation errors are never masked
  by a 503
- `src/controllers/auth.controller.js` + `src/routes/auth.routes.js`:
  - `POST /api/auth/login` - rate-limited (5 attempts / 10 min per IP),
    generic "Invalid username or password" for both wrong-password and
    unknown-username (no user enumeration), constant-time-ish via a dummy
    bcrypt compare on unknown usernames
  - `POST /api/auth/logout` - clears the session cookie, no DB needed
  - `GET /api/auth/me` - protected by `requireAuth`, returns the decoded
    session payload (never the password hash)
- `seed/createAdmin.js` - one-time setup script; reads `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` from the environment only, enforces an 8-character
  minimum, refuses to overwrite an existing account unless run with
  `--force`, and never logs the password
- `client/admin/login.html` + `client/admin/dashboard.html` (placeholder -
  full CRUD dashboard is Stage 4) + `client/assets/js/admin/admin-auth.js`
- `client/assets/js/api-config.js` - shared `API_BASE_URL`, used by both
  the medicine search and the admin scripts (no more duplication)

### Create the first admin
```
cd server
# edit .env: set ADMIN_USERNAME and ADMIN_PASSWORD (8+ chars)
npm run create-admin
```
Re-run with `--force` to reset an existing account's password. The
password itself is never printed to the console.

### Login flow
Visit `client/admin/login.html`. On success, the server sets an httpOnly
JWT cookie (never readable by frontend JS) and the page redirects to
`admin/dashboard.html`, which calls `GET /api/auth/me` to confirm the
session and shows the logged-in username. Visiting `dashboard.html`
directly without a valid session redirects to `login.html`. Logout clears
the cookie server-side and redirects back to `login.html`.

## Stage 4 - Admin medicine CRUD + real dashboard
- `src/models/Medicine.js` - added `category`, `description`; `available`
  is now derived automatically from `stock` in a `pre("save")` hook and
  is never accepted directly from any client (create/update schemas
  reject an `available` field outright rather than silently ignoring it)
- `src/validators/medicine.validator.js` - added `createMedicineSchema`
  (all fields required except category/description) and
  `updateMedicineSchema` (all fields optional, at least one required)
- `src/controllers/adminMedicines.controller.js` + `src/routes/adminMedicines.routes.js`:
  - `GET /api/admin/medicines?search=...` - list/search, scoped to the
    authenticated admin's own pharmacy
  - `POST /api/admin/medicines` - create
  - `PUT /api/admin/medicines/:id` - partial update (name/price/stock/category/description)
  - `DELETE /api/admin/medicines/:id` - delete
  - `pharmacyId` always comes from the verified JWT (`req.admin.pharmacyId`),
    never from the request body or a query param - one admin can never
    read, edit, or delete another pharmacy's medicines. A mismatched
    id returns 404 (not 403), so existence isn't leaked across tenants.
  - Route order: `requireAuth` + `requireAdmin` run before `requireDB`,
    so an unauthenticated request is rejected with 401 even if MongoDB
    happens to be down.
- `client/admin/dashboard.html` - replaced the Stage 3 placeholder with
  the real dashboard: overview stats (total / available / out-of-stock),
  search, medicines table, Add/Edit modal, Delete-confirm modal
- `client/assets/js/admin/admin-dashboard.js` - all CRUD logic; only
  initializes if the dashboard's table element is present on the page
- `client/assets/js/admin/admin-auth.js` - now dispatches an
  `admin-session-ready` event after confirming the session, so the CRUD
  script knows when it's safe to start loading data
- `seed/seed.js` - updated for the new schema (no more explicit `available`)

### Admin API summary
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/admin/medicines?search= | admin | list/search own pharmacy's medicines |
| POST | /api/admin/medicines | admin | create |
| PUT | /api/admin/medicines/:id | admin | partial update |
| DELETE | /api/admin/medicines/:id | admin | delete |

### Medicine schema (final)
```js
{
  pharmacyId: String,      // never client-settable - from admin session
  name: String,             // required
  price: Number,             // required, >= 0
  stock: Number,             // required, integer, >= 0
  available: Boolean,        // NEVER client-settable - derived from stock
  category: String,          // optional
  description: String,       // optional
  timestamps: true
}
```

## Stage 5 - Photo upload, cart, and WhatsApp checkout
- `src/models/Medicine.js` - added `imageUrl` (optional)
- `src/middleware/upload.js` - multer config: JPEG/PNG/WEBP only, 2MB
  limit, server-generated random filenames (never trusts the client's
  original filename), saves to `server/uploads/medicines/`
- `src/app.js` - serves `server/uploads/` at `/uploads` (static, read-only)
- `src/controllers/adminMedicines.controller.js` - create/update now
  accept an optional uploaded image; replacing an image deletes the old
  file from disk, deleting a medicine deletes its image too
- `src/validators/medicine.validator.js` - update no longer requires a
  text field if an image is being uploaded (image-only updates work)
- `client/assets/js/cart.js` - new: cart state (localStorage-backed),
  cart button/modal, checkout modal, geolocation, WhatsApp message builder
- `client/assets/js/medicine-search.js` - result cards now show
  description and photo (if any); price is intentionally NOT shown on
  the card (only in the cart/checkout); unavailable items show "Not
  Available" and have no Add-to-Cart control
- `client/admin/dashboard.html` + `admin-dashboard.js` - Add/Edit form
  has an optional photo field with live preview; table shows a thumbnail
  column; save requests now use `FormData` instead of JSON so the photo
  can travel with the other fields

### How the cart and checkout work
Each available medicine card has an "Add to Cart" checkbox; checking it
adds 1 to the cart and reveals a +/- quantity stepper. The floating cart
button (bottom-right) shows the item count and opens a cart modal with
per-item quantity controls, a remove button, a running total, "Clear
Cart", and "Proceed". Proceed opens a checkout modal asking for Name,
Mobile, and Address, plus an optional "Detect My Current Location"
button (browser geolocation - requires the user's permission).

### The WhatsApp handoff - what it actually does
Clicking "Place Order" builds a message and opens `https://wa.me/<pharmacy
number>?text=<order details>` in a new tab. **This pre-fills the message
in WhatsApp - it does not send it.** No website can make WhatsApp send a
message automatically without WhatsApp's paid Business API; the customer
must tap Send themselves once WhatsApp opens. Because they send it from
their own WhatsApp account, the pharmacy receives the order from the
customer's own number, exactly as requested. The message format:
```
🛒 NEW ORDER
👤 Name: ...
📱 Mobile: ...
🏠 Address: ...
💊 <medicine name> × <qty>          (one line per item)
💰 Total: ₹...
📍 Customer Current Location:        (only if location was detected)
Google Maps: <link>
🕐 Order Time: 13 Aug, 2:11 AM
```
The pharmacy's WhatsApp number is hardcoded in `cart.js` as
`PHARMACY_WHATSAPP_NUMBER` (currently the same number as the phone
number, `918810455046`) - change that constant if the pharmacy's WhatsApp
number is different from its phone number.

After the WhatsApp tab opens, a "Order Sent to WhatsApp" confirmation
modal appears and the cart is cleared.

## Run it
```
cd server
npm install
cp .env.example .env      # then edit .env with your real MongoDB URI etc.
npm run seed               # populates demo Shankar Pharmacy medicines
npm run create-admin        # set ADMIN_USERNAME/ADMIN_PASSWORD in .env first
npm start
```

Then open `client/index.html` via a local server (e.g. VS Code Live Server)
running on the origin set in `.env` as `CLIENT_ORIGIN` (default
`http://127.0.0.1:5500`). Public search is on the homepage; admin login is
at `client/admin/login.html`.

Visit: http://127.0.0.1:5000/api/health

## Note on MongoDB
This sandbox's network cannot reach MongoDB's binary-download servers, so
live-DB testing could not be done inside the sandbox. What WAS verified
end-to-end (real routes/controllers/validators/middleware, real JWT and
bcrypt, real multer image upload/disk storage/static serving, and the
actual browser UI for search/cart/checkout/admin dashboard) used a
temporary test harness that stubbed only the Mongoose model layer
(Admin.findOne, Medicine.find/findById/save/deleteOne, replicating the
pre-save availability-derivation logic) - that harness is not part of
this delivered project. Verified this way: full CRUD including image
upload/replace/delete (with real files written to and removed from
disk), validation rejections (negative price/stock, missing name,
invalid id, image-only updates, non-image file types), availability
correctly flipping both directions when stock changes, cross-tenant
isolation (an admin cannot read/edit/delete another pharmacy's
medicines - 404, not 403), admin changes appearing immediately in the
public API (single shared collection, no duplication), and the full
browser flow for both the public site (search showing
description/photo/no-price/Not-Available, add-to-cart, quantity,
checkout, geolocation via a mocked coordinate, the exact WhatsApp
message content) and the admin dashboard (login, stats, add/edit with
photo upload and live preview, search, delete, logout, protected-page
redirect). Real MongoDB persistence itself (documents actually saved and
surviving a restart) has NOT been tested and needs a real database.


To test against a real database:
- Local install: https://www.mongodb.com/docs/manual/administration/install-community/
- Or a free MongoDB Atlas cluster: https://www.mongodb.com/cloud/atlas/register
Put the connection string in `.env` as `MONGODB_URI`, then:
```
npm run seed            # demo medicines
npm run create-admin    # first admin account (set ADMIN_USERNAME/ADMIN_PASSWORD in .env first)
npm start
```


