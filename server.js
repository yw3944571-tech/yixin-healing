import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

app.use(express.static(
  path.join(__dirname, "public")
));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "奕心疗愈舍服务器正常运行"
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
