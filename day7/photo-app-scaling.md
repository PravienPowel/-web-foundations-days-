# SnapShare scaling plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of
photos from people they follow. This plan is for 10 million users.

## Assumptions

- 10,000,000 registered users
- 10% are active each day, so **1,000,000 daily active users (DAU)**
- Each active user uploads 1 photo a day
- Each active user views 50 feed pages a day
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail
- 1 day is about 100,000 seconds (rounded to make the maths easy)
- Peak traffic is 5 times the average

## Estimates

**Uploads**
- 1,000,000 users x 1 photo = 1,000,000 uploads per day
- 1,000,000 / 100,000 = about **10 uploads per second** on average
- At peak: 10 x 5 = about **50 uploads per second**

**Feed views**
- 1,000,000 users x 50 pages = 50,000,000 feed views per day
- 50,000,000 / 100,000 = about **500 feed views per second** on average
- At peak: 500 x 5 = about **2,500 feed views per second**

**Storage per year**
- Original photos: 1,000,000 x 2 MB = 2 TB per day
- Thumbnails: 1,000,000 x 50 KB = 50 GB per day
- Total: about 2.05 TB per day
- Per year: 2.05 TB x 365 = about **750 TB per year**

The database only keeps the details about each photo (who posted it, the
file link, the time), roughly 500 bytes each. That is about 500 MB a day, or
180 GB a year, which is small. Almost all the storage is the photo files.

## Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 500 feed views per second but only
10 uploads per second, so reads are about 50 times more common than writes.

What this means for the design:
- Cache feed data so most views never touch the database.
- Use a read replica so reads don't slow down the primary database.
- Serve photos and thumbnails from a CDN, close to the user.
- Writes (uploads) are few, so one primary database can handle them. The
  slow part of an upload (making the thumbnail) goes in the background.

One thing to watch: even though uploads are rare, each one is big (2 MB),
so the storage grows very fast.

## Why photos don't go in the database

A photo is a big file. A database is built for small, structured rows that
we search and filter, not for storing files. If we put 750 TB of photos in
it, the database would get huge and slow, backups would take forever, and
every photo request would use up a database connection that real queries
need. It is also much more expensive than file storage.

Photos go in **object storage** (like Amazon S3), which is made for large
files, is cheap and keeps copies safe. The database stores only a link to
each file. The CDN then serves the files from object storage.

## Architecture

```
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (snapshare.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  HTML, CSS, JS,        ┌─────────┐   miss   ┌────────────────┐
 │ Browser /     │  thumbnails, photos    │   CDN   │ <──────> │ Object storage │
 │ mobile app    │ ─────────────────────> │         │          │ (photo files)  │
 └────────┬──────┘                        └─────────┘          └───────┬────────┘
          │ API calls (HTTPS, JSON)                                    │
          v                                                    ┌───────┴───────┐
   ┌───────────────┐                                           │ saves photos  │
   │ Load balancer │                                           │ and thumbnails│
   └──────┬────────┘                                           └───────────────┘
     ┌────┴─────┬──────────┐                                       ^        ^
     v          v          v                                       │        │
 ┌───────┐  ┌───────┐  ┌───────┐   ┌──────────────┐               │        │
 │ App 1 │  │ App 2 │  │ App 3 │──>│ Cache (Redis)│               │        │
 └───┬───┘  └───┬───┘  └───┬───┘   └──────────────┘               │        │
     │          │          │                                      │        │
     │ writes   │ reads    │ upload: save original ───────────────┘        │
     v          v          │                                               │
 ┌─────────┐ ┌──────────┐  │ add job   ┌───────┐   ┌────────┐ makes        │
 │ Primary │>│ Read     │  └─────────> │ Queue │──>│ Worker │ thumbnail ───┘
 │   DB    │ │ replica  │              └───────┘   └───┬────┘
 └────^────┘ └──────────┘                              │
      └──────────── worker saves thumbnail link ───────┘
```

## What each component does

- **DNS** turns snapshare.com into the address of our servers, so users can find us.
- **CDN** keeps copies of the site files, thumbnails and photos on servers near the user, so pages load fast and our own servers get less traffic.
- **Load balancer** spreads requests across the app servers and stops sending traffic to any server that is down.
- **App servers** run the API code (log in, upload, build the feed); there are several, so one crashing doesn't take the app down, and they are stateless so any of them can handle any request.
- **Cache (Redis)** keeps recent feed results in memory, so most feed views are answered in about 1 ms without asking the database.
- **Primary database** stores the data about users, photos and who follows who, and it is the only place that accepts writes, so the data stays correct.
- **Read replica** is a copy of the primary that handles feed reads, so the heavy read traffic doesn't slow down uploads.
- **Object storage** holds the actual photo and thumbnail files cheaply and safely, so the database doesn't have to.
- **Queue** holds jobs like "make a thumbnail for photo 123", so the app can answer the user right away instead of waiting.
- **Worker** takes jobs from the queue and makes the thumbnails in the background, so a rush of uploads just means a longer queue, not a crashed server.

## Upload flow, step by step

1. The user picks a photo and the app sends `POST /photos` with their token.
2. The load balancer sends the request to a healthy app server.
3. The app server checks the token and checks the file (it must be an image and not too big).
4. The app server saves the original photo in object storage and gets back its file link.
5. The app server adds a row to the primary database: user id, file link, time, and status "processing".
6. The app server adds a job to the queue: "make a thumbnail for photo 123".
7. The app server replies `201 Created` straight away. The user sees their upload worked, and the app shows a placeholder until the thumbnail is ready.
8. A worker takes the job from the queue, downloads the original, and makes a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage.
10. The worker updates the photo's row in the primary database with the thumbnail link and sets the status to "ready".
11. The primary copies the change to the read replica a few milliseconds later. When followers load their feed, the cache is checked first, and on a miss the feed comes from the replica, with the thumbnail served by the CDN.

If the worker crashes halfway, the job stays in the queue and another worker
tries it again, so no photo is left without a thumbnail.

## Trade-offs

1. **Speed vs freshness (cache).** Caching the feed makes it very fast, but
   a follower might not see a new photo until the cache expires. I would use
   a short TTL of about a minute. A feed that is one minute out of date is
   fine for a photo app, so speed wins here.

2. **Fast uploads vs instant thumbnails (queue).** Making the thumbnail in
   the background means the upload replies quickly, but the thumbnail is not
   ready for a few seconds. We accept that and show a placeholder. It is
   better than making the user wait.

3. **Read replica lag (eventual consistency).** The replica is slightly
   behind the primary, so a user might upload a photo and not see it in their
   feed for a moment. This is okay for photos, but it would not be okay for
   something like a bank balance.

4. **Cost vs reliability (storage).** 750 TB a year is a lot of money to
   store. Keeping several copies and using a CDN makes the app reliable and
   fast, but costs more. To save money later, old photos that nobody views
   could move to cheaper storage.

5. **Simplicity vs scalability.** I kept SnapShare as one application (a
   monolith) instead of splitting it into many small services. It is easier
   to build and fix. We can split it later if the team grows.
