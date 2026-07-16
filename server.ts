import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 image uploads
  app.use(express.json({ limit: "15mb" }));

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Upload base64 image to local backup
  app.post("/api/upload", (req: express.Request, res: express.Response) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Nessuna immagine fornita." });
      }

      // Recognize "data:image/jpeg;base64,..." or similar
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Formato data URL non valido." });
      }

      const buffer = Buffer.from(matches[2], "base64");
      const ext = matches[1].split("/")[1] || "jpg";
      const filename = `upload_${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      // Return the relative URL
      res.json({ url: `/uploads/${filename}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve uploads statically
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

  // Vite middleware for development or serving dist in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
