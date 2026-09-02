import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// =========================
// PostgreSQL 数据库连接
// =========================

if (!process.env.DATABASE_URL) {
console.error("❌ DATABASE_URL 未设置");
process.exit(1);
}

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: {
rejectUnauthorized: false
}
});

// =========================
// 中间件
// =========================

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// =========================
// 初始化数据库
// =========================

async function initDatabase() {

try {

```
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    service VARCHAR(255) NOT NULL,
    price NUMERIC DEFAULT 0,
    duration VARCHAR(100),
    therapist VARCHAR(255) NOT NULL,
    service_date VARCHAR(50) NOT NULL,
    service_time VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    status VARCHAR(50) DEFAULT '待确认',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;

await pool.query(createTableQuery);

console.log("✅ PostgreSQL 数据库连接成功");
console.log("✅ orders 订单表已准备完成");
```

} catch (error) {

```
console.error("❌ PostgreSQL 初始化失败：", error);

process.exit(1);
```

}

}

// =========================
// 健康检查
// =========================

app.get("/api/health", async (req, res) => {

try {

```
await pool.query("SELECT 1");

return res.json({
  success: true,
  message: "奕心疗愈舍服务器正常运行",
  database: "connected"
});
```

} catch (error) {

```
return res.status(500).json({
  success: false,
  message: "服务器运行中，但数据库连接失败",
  database: "disconnected"
});
```

}

});

// =========================
// 创建订单
// =========================

app.post("/api/orders", async (req, res) => {

try {

```
const {
  service,
  price,
  duration,
  therapist,
  date,
  time,
  name,
  phone,
  address
} = req.body;


if (!service) {
  return res.status(400).json({
    success: false,
    message: "请选择疗愈服务"
  });
}

if (!therapist) {
  return res.status(400).json({
    success: false,
    message: "请选择疗愈师"
  });
}

if (!date) {
  return res.status(400).json({
    success: false,
    message: "请选择服务日期"
  });
}

if (!time) {
  return res.status(400).json({
    success: false,
    message: "请选择服务时间"
  });
}

if (!name) {
  return res.status(400).json({
    success: false,
    message: "请输入姓名"
  });
}

if (!phone) {
  return res.status(400).json({
    success: false,
    message: "请输入手机号"
  });
}

const phoneRegex = /^1[3-9]\d{9}$/;

if (!phoneRegex.test(phone)) {
  return res.status(400).json({
    success: false,
    message: "手机号格式不正确"
  });
}

if (!address) {
  return res.status(400).json({
    success: false,
    message: "请输入服务地址"
  });
}


const orderId =
  "YX" +
  Date.now() +
  Math.floor(Math.random() * 1000);


const order = {
  id: orderId,
  service,
  price: Number(price) || 0,
  duration,
  therapist,
  date,
  time,
  name,
  phone,
  address,
  status: "待确认",
  createdAt: new Date().toISOString()
};


const insertQuery = `
  INSERT INTO orders (
    id,
    service,
    price,
    duration,
    therapist,
    service_date,
    service_time,
    customer_name,
    phone,
    address,
    status
  )
  VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10, $11
  )
`;


await pool.query(
  insertQuery,
  [
    order.id,
    order.service,
    order.price,
    order.duration,
    order.therapist,
    order.date,
    order.time,
    order.name,
    order.phone,
    order.address,
    order.status
  ]
);


console.log("收到新预约订单：", order);


return res.json({
  success: true,
  message: "预约提交成功",
  order
});
```

} catch (error) {

```
console.error("创建订单失败：", error);

return res.status(500).json({
  success: false,
  message: "服务器处理失败"
});
```

}

});

// =========================
// 获取所有订单
// =========================

app.get("/api/orders", async (req, res) => {

try {

```
const result = await pool.query(`
  SELECT
    id,
    service,
    price,
    duration,
    therapist,
    service_date AS "date",
    service_time AS "time",
    customer_name AS "name",
    phone,
    address,
    status,
    created_at AS "createdAt"
  FROM orders
  ORDER BY created_at DESC
`);


return res.json({
  success: true,
  total: result.rows.length,
  orders: result.rows
});
```

} catch (error) {

```
console.error("获取订单失败：", error);

return res.status(500).json({
  success: false,
  message: "获取订单失败"
});
```

}

});

// =========================
// 启动服务器
// =========================

async function startServer() {

await initDatabase();

app.listen(PORT, () => {

```
console.log(
  `🚀 奕心疗愈舍服务器运行在端口 ${PORT}`
);
```

});

}

startServer();
