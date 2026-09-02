import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;


// =========================
// 中间件
// =========================

// 接收 JSON 数据
app.use(express.json());

// 静态网站
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// =========================
// 临时订单数据
// 下一步会升级 SQLite 数据库
// =========================

const orders = [];


// =========================
// 健康检查
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "奕心疗愈舍服务器正常运行"
  });
});


// =========================
// 创建订单
// POST /api/orders
// =========================

app.post("/api/orders", (req, res) => {

  try {

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


    // =====================
    // 基础验证
    // =====================

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


    // =====================
    // 创建订单
    // =====================

    const orderId =
      `YX${Date.now()}${Math.floor(
        Math.random() * 1000
      )}`;


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

      createdAt:
        new Date().toISOString()
    };


    // 保存订单
    orders.push(order);


    console.log(
      "收到新预约订单：",
      order
    );


    // 返回结果
    return res.json({
      success: true,
      message: "预约提交成功",
      order
    });

  } catch (error) {

    console.error(
      "创建订单失败：",
      error
    );

    return res.status(500).json({
      success: false,
      message: "服务器处理失败"
    });

  }

});


// =========================
// 获取所有订单
// GET /api/orders
// 下一步管理后台会使用
// =========================

app.get("/api/orders", (req, res) => {

  return res.json({
    success: true,
    total: orders.length,
    orders
  });

});


// =========================
// 启动服务器
// =========================

app.listen(PORT, () => {

  console.log(
    `奕心疗愈舍服务器运行在端口 ${PORT}`
  );

});
