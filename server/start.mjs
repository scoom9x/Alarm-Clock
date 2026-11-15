import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { aiMiddleware } from "./ai.mjs";
const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const api = aiMiddleware(process.env);
createServer((req, res) =>
  api(req, res, async () => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
      try {
        if ((await stat(file)).isDirectory())
          file = resolve(file, "index.html");
      } catch {
        file = resolve(root, "index.html");
      }
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }),
).listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () => console.log("Alarm Clock server ready"),
);
