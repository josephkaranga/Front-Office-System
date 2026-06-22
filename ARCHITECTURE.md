# Terrassa Village — Front Office System Architecture

## System Overview

A full-stack hotel Property Management System (PMS) built for East African hotels.
Supports dual deployment: **Vercel (cloud)** or **Electron (desktop/offline)**.

---

## Tech Stack

| Layer      | Technology                | Purpose                    |
|------------|---------------------------|----------------------------|
| Frontend   | React 18 + Tailwind CSS   | Single-page UI             |
| Backend    | Express.js (Node.js)      | REST API                   |
| Database   | Supabase (cloud) / SQLite (local) | Dual-mode persistence |
| Auth       | JWT + bcryptjs            | Stateless authentication   |
| Build      | Webpack 5                 | Bundle + optimize          |
| Desktop    | Electron                  | Windows .exe packaging     |
| Deploy     | Vercel                    | Serverless hosting         |

---

## Project Structure

```
/
├── api/
│   └── index.js              # Vercel serverless entry point
├── server/
│   ├── config.js              # Environment config (secrets)
│   ├── database.js            # Dual-mode DB adapter (Supabase/SQLite)
│   ├── db-helper.js           # Unified async CRUD interface
│   ├── index.js               # Local Express server entry
│   ├── seed.js                # Database seed script
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication + admin guard
│   │   └── security.js        # Rate limiting, sanitization, token blacklist
│   └── routes/
│       ├── auth.js            # Login, logout, users, shifts, passwords
│       ├── guests.js          # Guest CRUD + search
│       ├── rooms.js           # Room listing, status changes
│       ├── checkins.js        # Check-in, check-out with discount tracking
│       ├── reservations.js    # Future bookings
│       ├── payments.js        # Payment recording with transaction IDs
│       ├── extras.js          # Guest folio extras (food, drinks, services)
│       ├── reports.js         # Dashboard, revenue, occupancy, history
│       ├── housekeeping.js    # Cleaning/maintenance task workflow
│       ├── receipts.js        # Receipt generation with full billing
│       └── settings.js        # Hotel config (name, currency, logo)
├── src/
│   ├── index.js               # React entry point
│   ├── index.css              # Tailwind + component styles
│   ├── App.js                 # Router + auth/settings providers
│   ├── context/
│   │   ├── AuthContext.js     # Auth state (user, login, logout)
│   │   └── SettingsContext.js # Hotel settings, currency, payment methods
│   ├── components/
│   │   ├── Layout.js          # Sidebar + main area shell
│   │   ├── Sidebar.js         # Navigation with role-based filtering
│   │   ├── Header.js          # Page header with live clock
│   │   ├── Modal.js           # Reusable modal dialog
│   │   └── Receipt.js         # Printable receipt component
│   ├── pages/
│   │   ├── Login.js           # Login page with hotel branding
│   │   ├── Dashboard.js       # Stats, donut chart, room grid, activity
│   │   ├── CheckIn.js         # 2-step check-in with discount + payment
│   │   ├── GuestFolio.js      # In-house guests, extras, billing, checkout
│   │   ├── Reservations.js    # Future booking management
│   │   ├── GuestSearch.js     # Guest directory with profile panel
│   │   ├── Rooms.js           # Visual floor plan with images
│   │   ├── Housekeeping.js    # Task management (clean/maintain)
│   │   ├── Payments.js        # Transaction log with export
│   │   ├── Reports.js         # Revenue, occupancy, guest history + export
│   │   ├── ChannelManager.js  # OTA integrations (Booking.com, etc.)
│   │   └── Settings.js        # Hotel config, staff, permissions
│   └── utils/
│       └── api.js             # HTTP client for all API calls
├── public/
│   └── index.html             # HTML template
├── .env                       # Environment variables (secrets)
├── vercel.json                # Vercel deployment config
├── webpack.config.js          # Build configuration
├── tailwind.config.js         # Tailwind theme (colors, fonts)
├── main.js                    # Electron main process
├── preload.js                 # Electron preload
└── supabase-migration.sql     # Database schema for Supabase
```

---

## Data Flow

```
User Action → React Component → api.js → Express Route → db-helper → Supabase/SQLite
                                                                          ↓
User Sees   ← React State     ← JSON   ← Express Response ←──────── Query Result
```

---

## Authentication Flow

```
Login:  POST /api/auth/login → bcrypt verify → JWT signed → token returned
        Client stores token in localStorage
        All subsequent requests include: Authorization: Bearer <token>

Logout: POST /api/auth/logout → shift.logout_time updated → client clears token

Suspend: PUT /api/auth/users/:id/status → is_active=false
         + token added to in-memory blacklist → immediate session kill
```

---

## Accounting Model

```
Original Rate     = Rack rate (1 pax or 2 pax BB)
Discount/Night    = Reduction applied at check-in (stored, not a payment)
Charged Rate      = Original - Discount (what guest actually pays per night)

Net Amount Due    = (Charged Rate × Nights) + Extras
Payments          = Actual money received (cash, card, mobile money)
Balance           = Net Amount Due - Total Payments

Revenue Reports   = SUM(payments.amount) — only real money, never discounts
```

---

## Role-Based Access

| Feature              | Admin | Receptionist |
|----------------------|-------|--------------|
| Dashboard            | Full  | Limited (no revenue) |
| Check-In             | Yes   | Yes          |
| In-House / Checkout  | Yes   | Yes          |
| Reservations         | Yes   | Yes          |
| Guest Search         | Full profile | Masked IDs, no history |
| Rooms                | Full + status | View + status changes |
| Housekeeping         | Yes   | Yes          |
| Payments             | All staff | Own sales only |
| Reports              | Yes   | No           |
| Channel Manager      | Yes   | No           |
| Settings / Users     | Yes   | No           |
| Suspend Users        | Yes   | No           |

---

## Deployment

### Vercel (Production)
1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `DB_MODE=supabase`
   - `SUPABASE_URL=your_url`
   - `SUPABASE_KEY=your_key`
   - `JWT_SECRET=your_secret`
4. Deploy — Vercel builds frontend + runs API as serverless

### Local Development
```bash
npm install
npm run seed          # Populate database
npm start             # Starts server (3001) + webpack dev (8080)
```

### Desktop (Electron)
```bash
npm run electron:dev  # Development with hot reload
npm run dist          # Build Windows installer (.exe)
```

---

## Country-Specific Payment Methods

| Country      | Methods                                    |
|--------------|-------------------------------------------|
| Kenya        | Cash, M-Pesa, Airtel Money, Card, Bank    |
| Rwanda       | Cash, MTN MoMo, Airtel Money, Card, Bank  |
| Tanzania     | Cash, M-Pesa, Tigo Pesa, Airtel, Card     |
| Uganda       | Cash, MTN MoMo, Airtel Money, Card, Bank  |
| Ethiopia     | Cash, Telebirr, CBE Birr, Card, Bank      |
| Burundi      | Cash, Lumicash, Ecocash, Card, Bank       |
| Somalia      | Cash, EVC Plus, Zaad, Sahal, Bank         |

Auto-detected from Settings → Country.
