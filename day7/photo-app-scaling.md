# SnapShare scaling plan

SnapShare lets users upload photos and scroll a feed of photos from people they follow. This plan is for 10 million users.

## Assumptions
- 10M registered users, 10% active each day = **1M daily active users**
- Each active user: 1 upload and 50 feed views per day
- Photo = 2 MB, thumbnail = 50 KB
- 1 day is about 100,000 seconds; peak = 5x average

## Estimates
- Uploads: 1M per day / 100,000 = **10 per second** (peak **50**)
- Feed views: 1M x 50 = 50M per day / 100,000 = **500 per second** (peak **2,500**)
- Storage: (2 MB + 50 KB) x 1M = 2.05 TB per day, about **750 TB per year**

**Read-heavy:** 500 reads vs 10 writes per second (50 to 1). So we cache feeds, use a read replica, serve photos from a CDN, and do slow work (thumbnails) in the background. Storage grows fast because every upload is big.

## Architecture
```
Client --> DNS
Client --> CDN --(miss)--> Object storage (photos + thumbnails)
Client --> Load balancer --> App 1 | App 2 | App 3
App --> Cache (Redis)
App --writes--> Primary DB --copies--> Read replica <--reads-- App
App --saves original photo--> Object storage
App --adds job--> Queue --> Worker
Worker --saves thumbnail--> Object storage
Worker --saves thumbnail link--> Primary DB
```

## What each component does
- **DNS:** turns snapshare.com into our server address so users can find us.
- **CDN:** keeps photos and site files near the user, so pages load fast and our servers get less traffic.
- **Load balancer:** shares requests between app servers and skips any that are down.
- **App servers:** run the API; several of them, stateless, so one crash doesn't stop the app.
- **Cache (Redis):** keeps feeds in memory, so most views never touch the database.
- **Primary DB:** stores users, photos and follows; the only place that accepts writes.
- **Read replica:** a copy that answers feed reads, so reading doesn't slow uploads.
- **Object storage:** holds the big photo files cheaply and safely.
- **Queue:** holds jobs like "make a thumbnail", so the app can reply right away.
- **Worker:** makes thumbnails in the background, so an upload rush only lengthens the queue.

## Upload flow
1. The user picks a photo; the app sends `POST /photos` with their token.
2. The load balancer passes it to a healthy app server.
3. The app checks the token and the file (must be an image, not too big).
4. The app saves the original in object storage and gets its link.
5. The app adds a row to the primary DB (user, link, time, status "processing").
6. The app adds a "make thumbnail" job to the queue.
7. The app replies `201 Created` straight away; the user sees a placeholder.
8. A worker takes the job, makes a 50 KB thumbnail and saves it in object storage.
9. The worker updates the DB row with the thumbnail link and status "ready". If the worker crashes, the job stays in the queue and another worker retries.

## Trade-offs
1. **Speed vs freshness (cache):** a follower may not see a new photo for about a minute (short TTL). Fine for a photo app.
2. **Fast upload vs instant thumbnail (queue):** the reply is quick, but the thumbnail takes a few seconds. We show a placeholder.
3. **Read replica lag:** a replica is slightly behind, so a new photo may not show for a moment. OK for photos, not for a bank balance.
4. **Cost vs reliability:** 750 TB a year with copies and a CDN costs a lot but keeps the app fast and safe. Old photos can move to cheaper storage later.

## Why photos are not stored in the database
A photo is a big file, and a database is built for small rows. 750 TB inside it would make it slow, backups huge and costs high. Photos go in object storage; the database keeps only a link, and the CDN serves the files.
