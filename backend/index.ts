import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";

dotenv.config();

const app = express();

// ---------- basic middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan("dev"));

// ---------- CORS ----------
const allowlist = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
];

const clientUrl = process.env.CLIENT_URL;
console.log("CLIENT_URL =", clientUrl);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser requests (health checks, curl, server-to-server)
      if (!origin) return cb(null, true);

      // if no CLIENT_URL yet, allow local dev only
      if (!clientUrl) return cb(null, allowlist.includes(origin));

      // if CLIENT_URL exists, allow only that + local dev
      const ok = origin === clientUrl || allowlist.includes(origin);

      if (!ok) return cb(new Error(`CORS blocked for origin: ${origin}`), false);
      return cb(null, true);
    },
    credentials: true, // keep true if you use cookies/session
  })
);

// ---------- DB ----------
connectDB();

// ---------- routes ----------
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

app.use("/api/v1", routes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// ---------- error handler ----------
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

// ---------- start ----------
const port = Number(process.env.PORT) || 8000; // backend default should not clash with Next.js

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});