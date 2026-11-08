require("dotenv").config();
const app = require("./app");
const { getDb } = require("./db");

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await getDb(); // Wait for database setup before accepting requests.
    const server = app.listen(PORT, () => {
      console.log(`Books API running at http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
}

startServer();