const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

let database;

async function getDb() {
  if (!database) {
    const filename = process.env.DB_FILE || path.join(__dirname, "..", "books.db");
    database = await open({ filename, driver: sqlite3.Database });
    await database.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price REAL NOT NULL CHECK(price >= 0),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const row = await database.get("SELECT COUNT(*) AS count FROM books");
    if (row.count === 0) {
      await database.run(
        "INSERT INTO books (title, author, price) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
        "Database Management Systems", "Raghu Ramakrishnan", 650,
        "Computer Networks", "Andrew S. Tanenbaum", 720,
        "Operating System Concepts", "Abraham Silberschatz", 800
      );
    }
  }
  return database;
}

module.exports = { getDb };