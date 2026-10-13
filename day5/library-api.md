# Library API Design

This is a REST API design for the books in a library. The resource is `books`, and each book has an id, a title, an author and a year.

## Endpoints

### 1. List all books
- Method: GET
- Path: `/books`
- Description: Returns every book in the library.
- Request body: none
- Success status: 200 OK

### 2. Get one book
- Method: GET
- Path: `/books/42`
- Description: Returns the book with id 42.
- Request body: none
- Success status: 200 OK

### 3. Create a book
- Method: POST
- Path: `/books`
- Description: Adds a new book to the library.
- Request body: `{ "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1958 }`
- Success status: 201 Created

### 4. Update a book
- Method: PATCH
- Path: `/books/42`
- Description: Changes only the fields that are sent, for example the year.
- Request body: `{ "year": 1959 }`
- Success status: 200 OK

### 5. Delete a book
- Method: DELETE
- Path: `/books/42`
- Description: Removes the book with id 42.
- Request body: none
- Success status: 204 No Content

### 6. List books by an author
- Method: GET
- Path: `/books?author=Chinua Achebe`
- Description: Returns only the books written by that author. The author goes in a query parameter after the `?`.
- Request body: none
- Success status: 200 OK

## Error codes

### 400 Bad Request
- The request is not valid.
- Example: `POST /books` with an empty title, like `{ "title": "", "author": "Chinua Achebe" }`.

### 404 Not Found
- The book or the URL does not exist.
- Example: `GET /books/9999` when there is no book with id 9999.
