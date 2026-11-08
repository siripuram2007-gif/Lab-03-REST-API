const express = require("express");
const { getDb } = require("./db");

const app = express();
app.use(express.json());

// A consistent JSON error shape for every API error.
function sendError(res, status, message) {
  return res.status(status).json({ message });
}

const allowedSortColumns = {
  title: "title",
  author: "author",
  price: "price",
  id: "id"
};

// GET /books?search_q=database&order_by=price&order=ASC&limit=10&offset=0&min_price=100&max_price=900
app.get("/books", async (req, res, next) => {
  try {
    const {
      search_q = "",
      order_by = "id",
      order = "ASC",
      limit = "10",
      offset = "0",
      min_price,
      max_price
    } = req.query;

    const sortColumn = allowedSortColumns[String(order_by).toLowerCase()];
    if (!sortColumn) return sendError(res, 400, "order_by must be id, title, author, or price.");

    const sortDirection = String(order).toUpperCase();
    if (!["ASC", "DESC"].includes(sortDirection)) {
      return sendError(res, 400, "order must be ASC or DESC.");
    }

    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return sendError(res, 400, "limit must be an integer between 1 and 100.");
    }
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      return sendError(res, 400, "offset must be a non-negative integer.");
    }

    const conditions = [];
    const params = [];

    if (String(search_q).trim()) {
      conditions.push("title LIKE ?");
      params.push(`%${String(search_q).trim()}%`);
    }

    if (min_price !== undefined) {
      const min = Number(min_price);
      if (!Number.isFinite(min) || min < 0) return sendError(res, 400, "min_price must be a non-negative number.");
      conditions.push("price >= ?");
      params.push(min);
    }

    if (max_price !== undefined) {
      const max = Number(max_price);
      if (!Number.isFinite(max) || max < 0) return sendError(res, 400, "max_price must be a non-negative number.");
      conditions.push("price <= ?");
      params.push(max);
    }

    if (min_price !== undefined && max_price !== undefined && Number(min_price) > Number(max_price)) {
      return sendError(res, 400, "min_price cannot be greater than max_price.");
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT id, title, author, price, created_at FROM books ${whereSql}
                 ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    params.push(parsedLimit, parsedOffset);

    const db = await getDb();
    const books = await db.all(sql, params);
    return res.status(200).json({
      message: "Books retrieved successfully.",
      count: books.length,
      pagination: { limit: parsedLimit, offset: parsedOffset },
      data: books
    });
  } catch (error) {
    next(error);
  }
});

// GET /books/:id - path parameter identifies one book.
app.get("/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return sendError(res, 400, "id must be a positive integer.");
    const db = await getDb();
    const book = await db.get("SELECT id, title, author, price, created_at FROM books WHERE id = ?", id);
    if (!book) return sendError(res, 404, "Book not found.");
    return res.status(200).json({ message: "Book retrieved successfully.", data: book });
  } catch (error) {
    next(error);
  }
});

// POST /books - create a book.
app.post("/books", async (req, res, next) => {
  try {
    const { title, author, price } = req.body || {};
    if (typeof title !== "string" || !title.trim()) return sendError(res, 400, "title is required and must be a non-empty string.");
    if (typeof author !== "string" || !author.trim()) return sendError(res, 400, "author is required and must be a non-empty string.");
    if (price === undefined || price === null || price === "" || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return sendError(res, 400, "price is required and must be a non-negative number.");
    }

    const db = await getDb();
    const result = await db.run(
      "INSERT INTO books (title, author, price) VALUES (?, ?, ?)",
      title.trim(), author.trim(), Number(price)
    );
    const created = await db.get("SELECT id, title, author, price, created_at FROM books WHERE id = ?", result.lastID);
    return res.status(201).json({ message: "Book created successfully.", data: created });
  } catch (error) {
    next(error);
  }
});

// PUT /books/:id - update all editable fields.
app.put("/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return sendError(res, 400, "id must be a positive integer.");
    const { title, author, price } = req.body || {};
    if (typeof title !== "string" || !title.trim()) return sendError(res, 400, "title is required and must be a non-empty string.");
    if (typeof author !== "string" || !author.trim()) return sendError(res, 400, "author is required and must be a non-empty string.");
    if (price === undefined || price === null || price === "" || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return sendError(res, 400, "price is required and must be a non-negative number.");
    }

    const db = await getDb();
    const existing = await db.get("SELECT id FROM books WHERE id = ?", id);
    if (!existing) return sendError(res, 404, "Book not found.");

    await db.run(
      "UPDATE books SET title = ?, author = ?, price = ? WHERE id = ?",
      title.trim(), author.trim(), Number(price), id
    );
    const updated = await db.get("SELECT id, title, author, price, created_at FROM books WHERE id = ?", id);
    return res.status(200).json({ message: "Book updated successfully.", data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /books/:id - delete a book.
app.delete("/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return sendError(res, 400, "id must be a positive integer.");
    const db = await getDb();
    const existing = await db.get("SELECT id FROM books WHERE id = ?", id);
    if (!existing) return sendError(res, 404, "Book not found.");
    await db.run("DELETE FROM books WHERE id = ?", id);
    return res.status(200).json({ message: "Book deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => sendError(res, 404, "Route not found."));

// Central error handler: malformed JSON and unexpected server errors.
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return sendError(res, 400, "Invalid JSON request body.");
  }
  console.error(error);
  return sendError(res, 500, "Internal server error.");
});

module.exports = app;