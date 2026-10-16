# TicketHub design document

TicketHub is a website that sells tickets for concerts and events. Most days
it is quiet, but when a popular concert goes on sale, a huge crowd arrives
at the same moment and fights for a small number of seats. This document
designs the system for both situations.

**Goals:** fast browsing, correct sales (no seat sold twice), and surviving
the big sale.
**Non-goals:** refunds, ticket resale, mobile ticket scanning at the door,
and recommendations. We leave these out to keep the design small.

## 1. Requirements

**Functional (what it does)**
- Users can register and log in.
- Users can browse events and see the details of one event.
- Users can see which seats are available for an event.
- Users can pick seats and hold them for a short time (10 minutes) while they pay.
- Users can pay and receive their tickets.
- Users can see their past orders and tickets.

**Non-functional (how well it does it)**
- **Correct:** a seat can never be sold to two people. This is the most important rule.
- **Fair:** during a big sale, people are served in a fair order and nobody is left staring at a crashed site.
- **Fast:** browsing pages load in under 1 second; holding a seat answers in under 1 second.
- **Available:** browsing stays up even if one server fails (about 99.9%).
- **Safe with money:** a user is never charged twice for the same order, and never charged for a seat they didn't get.
- **Secure:** HTTPS, passwords stored as hashes, only the server talks to the database.

## 2. Estimates

Assumptions: 1 day is about 100,000 seconds (rounded), and peak traffic on a
normal day is 5 times the average.

### Normal day

```
Browsing:  50,000 visitors x 10 pages = 500,000 page views per day
           500,000 / 100,000 = about 5 reads per second
           Peak (x5): about 25 reads per second

Sales:     5,000 tickets per day
           5,000 / 100,000 = about 0.05 sales per second (one every 20 seconds)
           Peak (x5): about 0.25 sales per second

Storage:   5,000 orders per day x 365 = about 1.8 million orders per year
           1.8 million x 500 bytes = about 1 GB per year
```

A normal day is tiny. One server and one database could handle it.

### Big sale (one popular concert)

```
200,000 people try to buy within 10 minutes (600 seconds)
200,000 / 600 = about 330 new people arriving per second

Assume each person makes about 10 requests (event page, seat map, seat
attempts, hold, pay):
2,000,000 requests / 600 = about 3,300 requests per second

Only 20,000 seats exist, so only 20,000 / 600 = about 33 successful
holds per second on average (more in the first minute, because the best
seats go fast).
```

### Comparison

| | Normal day (peak) | Big sale |
|---|---|---|
| Requests per second | about 25 | about 3,300 |
| Seat sales per second | about 0.25 | about 33 |

The big sale has about **130 times** more requests than a normal peak, and
**9 out of 10 people will not get a ticket** (200,000 people for 20,000
seats). This tells us two things:

- The design must be built for the sale, not for the normal day.
- The hard part is not storage (the data is small). It is **many people
  fighting over the same few rows** (the seats), and being fair and honest to
  the 180,000 people who lose.

## 3. API

Base URL: `https://api.tickethub.example/v1`. JSON everywhere. The user's
token is sent as `Authorization: Bearer <token>` (except for browsing and
login).

| Method | Path | What it does | Success |
|--------|------|--------------|---------|
| POST | `/users` | Register | 201 Created |
| POST | `/auth/login` | Log in and get a token | 200 OK |
| GET | `/events` | List events (`?page=`, `?city=`) | 200 OK |
| GET | `/events/{id}` | Details of one event | 200 OK |
| GET | `/events/{id}/seats` | Seats of an event and their status (`?status=available`) | 200 OK |
| POST | `/events/{id}/holds` | Hold one or more seats for 10 minutes | 201 Created |
| DELETE | `/holds/{id}` | Let go of a hold early | 204 No Content |
| POST | `/orders` | Pay for a hold and get the tickets | 201 Created |
| GET | `/orders` | List my orders and tickets | 200 OK |

**Hold seats** (`POST /events/7/holds`):

```json
{ "seatIds": [1201, 1202] }
```

Response `201 Created`:

```json
{
  "holdId": "h_88f3",
  "seatIds": [1201, 1202],
  "expiresAt": "2026-10-20T18:10:00Z"
}
```

If one of the seats was just taken, the answer is `409 Conflict` and
**none** of the seats are held:

```json
{ "error": { "code": "SEAT_TAKEN", "message": "Seat 1202 is no longer available." } }
```

**Pay** (`POST /orders`). The client sends an `Idempotency-Key` header (a
random id for this attempt). If the request is sent twice by accident (a
double click, or a retry after a bad connection), the server sees the same
key and returns the first result instead of charging again.

```json
{ "holdId": "h_88f3", "paymentToken": "tok_abc123" }
```

Other errors: `401` (not logged in), `404` (event not found), `410 Gone` (the
hold has expired), `429` (too many requests), `402` (payment failed).

## 4. Data model

Four tables: **users**, **events**, **seats** and **orders**.

- **users** - one row per account.
- **events** - one row per concert or event, with the time it goes on sale.
- **seats** - one row per seat **per event**. It holds the seat's status
  (`available`, `held` or `sold`) and who is holding it.
- **orders** - one row per completed purchase.

**Relationships**
- One user has many orders (one-to-many; `orders.user_id`).
- One event has many seats (one-to-many; `seats.event_id`).
- One event has many orders (one-to-many; `orders.event_id`).
- One order has many seats (one-to-many; `seats.order_id`). Because a seat
  row belongs to a single event, it can be in at most one order.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  on_sale_at TEXT NOT NULL
);

CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  event_id     INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE seats (
  id               INTEGER PRIMARY KEY,
  event_id         INTEGER NOT NULL,
  section          TEXT NOT NULL,
  row_label        TEXT NOT NULL,
  seat_number      INTEGER NOT NULL,
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'held', 'sold')),
  held_by          INTEGER,        -- the user holding it (empty if available)
  hold_expires_at  TEXT,           -- when the hold runs out
  order_id         INTEGER,        -- filled in when sold
  FOREIGN KEY (event_id)  REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (held_by)   REFERENCES users(id),
  FOREIGN KEY (order_id)  REFERENCES orders(id),
  UNIQUE (event_id, section, row_label, seat_number)  -- no duplicate seat rows
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_orders_user ON orders(user_id);
```

The index on `seats(event_id, status)` makes "show me the available seats
for this event" fast, which is the query the whole crowd runs during the sale.

## 5. How we prevent two people buying the same seat

This is the most important part of the design. The idea: **the database
decides who gets a seat, in one step that can't be split, and nothing else
(not the browser, not the cache, not the app server's memory) is allowed to
decide.**

### Step 1: Holding a seat is one atomic UPDATE

```sql
UPDATE seats
SET status = 'held', held_by = :user_id,
    hold_expires_at = datetime('now', '+10 minutes')
WHERE id = :seat_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < datetime('now')));
```

The `WHERE` part checks that the seat is free **in the same statement** that
takes it. The database handles changes to one row one at a time. So if Amina
and Brian press the button for seat 1201 at the same instant, one of them runs
first and takes it. When the second runs, the seat is already `held`, the
`WHERE` doesn't match, and **0 rows are changed**. The server sees 0 rows and
replies `409 Conflict`. Only one person can ever get 1 row changed.

The mistake to avoid is "first SELECT to see if the seat is free, then
UPDATE". Between those two steps another user could sneak in, and both people
would think they got the seat. That is the classic double-booking bug (a race
condition).

### Step 2: Several seats are held in a transaction

When a user holds 2 or more seats, all the `UPDATE` statements run inside one
transaction (`BEGIN ... COMMIT`). If any seat comes back with 0 rows changed,
the server runs `ROLLBACK`, so the user ends up with **all** their seats or
**none**, and never half a group. This is the "atomicity" part of ACID.

### Step 3: Paying is also checked inside a transaction

```sql
BEGIN TRANSACTION;

INSERT INTO orders (user_id, event_id, total_cents) VALUES (:user_id, :event_id, :total);

UPDATE seats
SET status = 'sold', order_id = :order_id
WHERE id IN (:seat_ids)
  AND held_by = :user_id
  AND status = 'held'
  AND hold_expires_at > datetime('now');

-- the server checks that the number of changed rows equals the number of seats
-- if not: ROLLBACK (the hold expired or was lost). If yes: COMMIT.
COMMIT;
```

The seat only becomes `sold` if **this user** still holds it and the hold
hasn't expired. If the user took too long and someone else grabbed the seat,
the count won't match, everything rolls back, and the user gets `410 Gone`
(and isn't charged).

### Extra safety nets in the database

- The `CHECK` rule on `status` only allows `available`, `held` or `sold`.
- A seat row has only one `order_id` column, so a seat can't be in two orders.
- The `UNIQUE (event_id, section, row_label, seat_number)` rule stops
  duplicate seat rows from being created for the same real seat.
- These rules live in the database, so they protect the data even if there
  is a bug in the app code or several servers run at once.

### Expired holds

Someone might hold seats and then walk away. The `WHERE` in step 1 already
treats an expired hold as free, so other buyers can take those seats right
away. A background worker also runs every minute and resets old holds to
`available`, so the seat map stays tidy.

### Why not use the cache for this?

The cache and the read replica may show a seat as "available" a few seconds
after it was taken. That's fine for **showing** the seat map, because the user
who clicks a stale seat just gets a `409` and picks another. But the **decision**
always happens on the primary database with the atomic `UPDATE`.

## 6. Architecture

```
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (tickethub.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  static files, images  ┌─────────────────────────┐
 │ Client        │ ─────────────────────> │ CDN (HTML, CSS, JS,     │
 │ (browser or   │                        │ event images)           │
 │  phone app)   │                        └─────────────────────────┘
 └────────┬──────┘
          │ API calls (HTTPS, JSON)
          v
   ┌───────────────────┐   too many people at once?
   │ Rate limiter +    │ ── yes: wait in line ──> [ Waiting room ]
   │ load balancer     │                                │ lets people in
   └──────┬────────────┘ <──────────────────────────────┘ at a steady pace
     ┌────┴─────┬──────────┐
     v          v          v
 ┌───────┐  ┌───────┐  ┌───────┐         ┌───────────────┐
 │ App 1 │  │ App 2 │  │ App 3 │ ──────> │ Cache (Redis) │  events, seat map (display only)
 └───┬───┘  └───┬───┘  └───┬───┘         └───────────────┘
     │          │          │
     │ holds,   │ browsing │ jobs (emails, tickets)        ┌──────────────────┐
     │ orders   │ reads    │                               │ Payment provider │
     v          v          v                               └────────^─────────┘
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐                    │
 │ Primary │>│ Read     │ │ Queue │──>│ Worker │  emails, tickets,  │
 │   DB    │ │ replica  │ └───────┘   └────────┘  expired holds     │
 └─────────┘ └──────────┘                                           │
      ^                                                             │
      └─────────── App servers call the payment provider ───────────┘
```

### What each component does

- **Client** is the browser or phone app the user sees; it sends the API requests.
- **DNS** turns tickethub.com into the address of our servers so people can find us.
- **CDN** keeps the site files and event images on servers close to the user, so browsing is fast and most traffic never reaches our servers.
- **Rate limiter** stops one user or script from sending too many requests (it answers 429), which also helps against bots that try to grab all the seats.
- **Waiting room** puts people in a fair first-come line during a big sale and lets them in at a steady pace, so the servers never receive all 200,000 people at once.
- **Load balancer** shares requests across the app servers and skips any server that is down.
- **App servers** run the API code and are stateless, so we can add more of them for the sale and any one can fail without losing data.
- **Cache (Redis)** keeps event pages and the seat map in memory so most browsing never touches the database; it is used for display only, never to decide who gets a seat.
- **Primary database** is the single source of truth: every hold and every sale is decided here with the atomic updates above, so seats are never double-booked.
- **Read replica** is a copy of the primary that answers browsing queries, so the crowd looking at seats doesn't slow down the people who are buying.
- **Queue** holds background jobs (confirmation emails, creating ticket PDFs, releasing expired holds), so the app can answer the buyer right away.
- **Worker** does the jobs from the queue in the background, so a flood of orders only makes the queue longer instead of slowing down the sale.
- **Payment provider** is an outside service that takes the money, so we never store card details ourselves.

### How it survives the big sale

1. **Before the sale,** the event page and images are already on the CDN and
   in the cache, so the first rush of browsing doesn't hit the database.
2. **At the start,** the waiting room lets in only as many people as the
   system can handle (for example, a couple of thousand at a time). The rest
   see "You are number 41,230 in line". This turns a spike of 3,300 requests
   per second into a steady flow.
3. **While buying,** reads go to the cache and read replica. Only holds and
   orders go to the primary database, which sees tens of writes per second,
   not thousands.
4. **When seats run out,** the system answers fast with "sold out" instead of
   timing out, so the 180,000 people who don't get a ticket are told clearly
   and quickly.
5. **If a server crashes,** the load balancer stops sending it traffic and
   the others carry on. Because the app servers are stateless, nothing is lost.
6. **Money is protected** by the `Idempotency-Key` on payments, so a retry
   never charges twice.

## 7. Trade-offs

1. **Strict correctness vs speed (primary database for holds).** Every seat
   hold goes to one primary database instead of using the faster cache. That
   limits how fast we can sell, but it is the only way to guarantee no
   double-booking. We accept it because selling the same seat twice is far
   worse than being a bit slower, and the waiting room keeps the load on
   the primary small enough.
2. **Hold time: short vs long.** A 10-minute hold gives people time to pay,
   but seats held by people who walk away are unavailable to others for
   that time, and the organiser might lose sales. A shorter hold sells
   more seats but rushes real buyers and causes failed payments. 10 minutes
   is a middle choice.
3. **Fairness vs simplicity (waiting room).** The waiting room makes the sale
   fair and protects the servers, but it is extra complexity and some users
   will hate waiting. Without it the site would probably crash, which is
   less fair for everyone.
4. **Stale seat map vs cost.** Showing the seat map from the cache is cheap
   and fast, but it can be a few seconds out of date, so some people will
   click a seat that was just taken and get an error. We accept this because
   the real check is always done on the primary database.
5. **Simplicity vs scalability.** We keep one application and one primary
   database instead of splitting into many services or sharding. At 33
   successful holds per second this is enough, and it is much easier to build
   and keep correct. Splitting would be a later step if TicketHub grows to many
   big sales at the same time.

### Single points of failure

App servers, the load balancer and the CDN all have copies. The primary
database has a read replica that can be promoted if the primary fails, with
regular backups on top. If the cache goes down, the app falls back to the
database (slower but working). If a worker crashes, jobs wait in the queue
for another one.

## Risks and open questions

- Bots may try to buy all the seats; rate limiting and a login requirement help, but real protection (like CAPTCHAs) is still to be decided.
- What exactly happens if the payment goes through but the server crashes before the order is saved? We need a way to check with the payment provider and fix such orders.
- How many people should the waiting room let in at once? It needs to be tested with a load test before the first big sale.
