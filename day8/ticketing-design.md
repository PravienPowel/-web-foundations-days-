# TicketHub design document

TicketHub sells tickets for concerts and events. Most days are quiet, but a popular sale brings a huge crowd.

## 1. Requirements
**Functional:** register/log in; browse events; see seat availability; hold seats for 10 minutes; pay and get tickets; view my orders.
**Non-functional:** **correct** (a seat is never sold twice), **fair** (a big sale is served in order), **fast** (pages under 1 s), **available** (about 99.9%), **safe with money** (never charged twice), **secure** (HTTPS, hashed passwords).

## 2. Estimates (1 day is about 100,000 s; peak = 5x average)
**Normal day:** 50,000 x 10 = 500,000 page views / 100,000 = **5 reads/s** (peak 25). 5,000 tickets a day = **0.05 sales/s** (peak 0.25).
**Big sale:** 200,000 people in 600 s = about 330 arrivals/s. At about 10 requests each (my assumption) that is **about 3,300 requests/s**; 20,000 seats / 600 s = **about 33 sales/s**.
**Comparison:** about **130x** the requests of a normal peak, and 9 in 10 people get no ticket. Storage is tiny (about 1 GB a year); the real bottleneck is **many people fighting over the same 20,000 seat rows**.

## 3. API (JSON, `Authorization: Bearer <token>`)
| Method | Path | Success |
|---|---|---|
| GET | `/events` | 200 |
| GET | `/events/{id}` | 200 |
| GET | `/events/{id}/seats` | 200 |
| POST | `/events/{id}/holds` body `{"seatIds":[1201,1202]}` | 201 |
| POST | `/orders` body `{"eventId":7,"seatIds":[1201,1202],"paymentToken":"tok_1"}` | 201 |
| GET | `/orders` | 200 |

Errors: `401` not logged in, `404` not found, `409` seat taken (none of the seats are held), `410` hold expired, `402` payment failed, `429` too many requests. `POST /orders` needs an `Idempotency-Key` header: a retry with the same key returns the first result instead of charging again.

## 4. Data model
Relationships: user 1-to-many orders; event 1-to-many seats; order 1-to-many seats (a seat is in at most one order).
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  starts_at TEXT NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  total_cents INTEGER NOT NULL);
CREATE TABLE seats (id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  label TEXT NOT NULL, price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','held','sold')),
  held_by INTEGER REFERENCES users(id), hold_expires_at TEXT,
  order_id INTEGER REFERENCES orders(id),
  UNIQUE (event_id, label));
```

## 5. Preventing double-booking
The database decides, in one unsplittable step. **Hold** (1 row changed = got it, 0 rows = `409`):
```sql
UPDATE seats SET status='held', held_by=:user,
  hold_expires_at=datetime('now','+10 minutes')
WHERE id=:seat AND (status='available'
  OR (status='held' AND hold_expires_at < datetime('now')));
```
The check and the change happen in one statement (an optimistic check). If two people press at once, one runs first; for the second the seat is no longer free, so 0 rows change. A separate SELECT then UPDATE would allow a race. Several seats are held in one transaction and rolled back if any seat gives 0 rows (all or none). **Pay**:
```sql
BEGIN;
INSERT INTO orders (user_id,event_id,total_cents) VALUES (:user,:event,:total);
UPDATE seats SET status='sold', order_id=:order_id
WHERE id IN (:seat_ids) AND held_by=:user AND status='held'
  AND hold_expires_at > datetime('now');
-- rows changed must equal the number of seats, else ROLLBACK and reply 410
COMMIT;
```
Expired holds can be taken at once. The cache and replica are for **display only**: a stale seat just gives a `409`; they never decide ownership.

## 6. Architecture
```
Client --> DNS
Client --> CDN (pages, images)
Client --> Waiting room (big sales) --> Load balancer --> App 1 | App 2 | App 3
App servers --> Cache (Redis)          (events, seat map: display only)
App servers --> Primary DB --copies--> Read replica   (holds, orders / browsing)
App servers --> Queue --> Worker       (emails, tickets, expired holds)
App servers --> Payment provider       (takes the money)
```
- **CDN:** serves pages and images near the user.
- **Waiting room:** lets people into a big sale at a steady pace.
- **Load balancer:** spreads requests and skips dead servers.
- **App servers:** stateless API; add more for a sale.
- **Cache:** event pages and seat map, display only.
- **Primary DB:** every hold and sale is decided here, so no double-booking.
- **Read replica:** answers browsing reads so buyers are not slowed.
- **Queue + worker:** emails, ticket PDFs and expired-hold cleanup in the background.
- **Payment provider:** takes the money, so we never store cards.

**Surviving the sale:** CDN and cache absorb browsing, the waiting room keeps the primary DB at tens of writes per second, and "sold out" is answered fast. No single point of failure: servers have copies, the replica can be promoted, and if the cache fails the app uses the database.

## 7. Trade-offs
1. **Correctness vs speed:** all holds go to one primary DB, not the cache. Slower, but never double-sells.
2. **10-minute hold:** enough time to pay, but abandoned seats stay locked for 10 minutes.
3. **Waiting room:** fair and protects servers, but adds complexity and waiting.
4. **Stale seat map:** cheap and fast, but some clicks give `409`; the real check is atomic.
