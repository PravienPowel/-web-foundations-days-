# Reflection

The most difficult concept for me was caching, especially knowing when the
cache is allowed to be wrong. At first it seemed strange that a system could
show out-of-date data on purpose. It made sense when I followed one request
through the diagram step by step, GET /notes first and then POST /notes, and
saw that deleting the cached notes after every write keeps the data fresh. I
also practised the load estimates by hand until the numbers stopped feeling
random. Writing the TicketHub design helped too, because it showed me there
are places where the cache must not make the decision, like who gets a seat.

If I could improve my capstone, I would add more detail to the part about
failures. My design explains how to avoid single points of failure, but I
could show more clearly what the user sees when something breaks, and how we
would notice it with logs and alerts. I would also make my API client show
more specific error messages, for example a different one for a lost
connection and for a server error.

Next I want to build a real backend with Node.js and Express, so I can turn
my API design into working code. After that I want to connect it to a real
database and store QuickNotes for real users, using the SQL I learned in this
course.
