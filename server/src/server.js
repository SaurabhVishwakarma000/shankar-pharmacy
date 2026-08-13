const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB(); // logs success/failure, does not block server startup
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://127.0.0.1:${PORT}`);
  });
}

start();
