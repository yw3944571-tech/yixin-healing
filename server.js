import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pg;

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "未登录"
    });
  }

  const token = auth.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "登录已过期，请重新登录"
    });
  }
}

/* ================================
   数据库初始化
================================ */

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(100) PRIMARY KEY,
      service VARCHAR(255),
      price NUMERIC,
      duration VARCHAR(50),
      therapist VARCHAR(255),
      therapist_id INTEGER,
      service_date DATE,
      service_time TIME,
      customer_name VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      status VARCHAR(50) DEFAULT '待确认',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS therapist_id INTEGER
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS therapists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      avatar TEXT,
      bio TEXT,
      experience VARCHAR(255),
      specialties TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS avatar TEXT
  `);

  await pool.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS bio TEXT
  `);

  await pool.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS experience VARCHAR(255)
  `);

  await pool.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS specialties TEXT
  `);

  await pool.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS therapist_schedules (
      id SERIAL PRIMARY KEY,
      therapist_id INTEGER NOT NULL,
      work_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (therapist_id, work_date)
    )
  `);

  console.log("PostgreSQL 数据库连接成功");
  console.log("orders 订单表已准备完成");
  console.log("therapists 疗愈师表已准备完成");
  console.log("therapist_schedules 排班表已准备完成");
}

/* ================================
   健康检查
================================ */

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "服务器运行正常",
      database: "connected"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "数据库连接失败"
    });
  }
});

/* ================================
   管理员登录
================================ */

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "账号或密码错误"
    });
  }

  const token = jwt.sign(
    {
      username,
      role: "admin"
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );

  res.json({
    success: true,
    token
  });
});

/* ================================
   疗愈师
================================ */

app.get("/api/admin/therapists", adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        avatar,
        bio,
        experience,
        specialties,
        is_active,
        created_at
      FROM therapists
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      therapists: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取疗愈师失败"
    });
  }
});

app.post("/api/admin/therapists", adminAuth, async (req, res) => {
  try {
    const {
      name,
      avatar = "",
      bio = "",
      experience = "",
      specialties = "",
      is_active = true
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "请输入疗愈师姓名"
      });
    }

    const result = await pool.query(`
      INSERT INTO therapists (
        name,
        avatar,
        bio,
        experience,
        specialties,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      avatar,
      bio,
      experience,
      specialties,
      is_active
    ]);

    res.json({
      success: true,
      therapist: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "添加疗愈师失败"
    });
  }
});

app.patch("/api/admin/therapists/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      avatar,
      bio,
      experience,
      specialties,
      is_active
    } = req.body;

    const result = await pool.query(`
      UPDATE therapists
      SET
        name = COALESCE($1, name),
        avatar = COALESCE($2, avatar),
        bio = COALESCE($3, bio),
        experience = COALESCE($4, experience),
        specialties = COALESCE($5, specialties),
        is_active = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING *
    `, [
      name,
      avatar,
      bio,
      experience,
      specialties,
      is_active,
      id
    ]);

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "疗愈师不存在"
      });
    }

    res.json({
      success: true,
      therapist: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "修改疗愈师失败"
    });
  }
});

app.delete("/api/admin/therapists/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `
      DELETE FROM therapists
      WHERE id = $1
      `,
      [id]
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "删除疗愈师失败"
    });
  }
});

/* ================================
   用户端疗愈师
================================ */

app.get("/api/therapists", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        avatar,
        bio,
        experience,
        specialties,
        is_active
      FROM therapists
      WHERE is_active = TRUE
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      therapists: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取疗愈师失败"
    });
  }
});

/* ================================
   排班
================================ */

app.get("/api/admin/schedules", adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.therapist_id,
        t.name AS therapist_name,
        s.work_date,
        s.start_time,
        s.end_time
      FROM therapist_schedules s
      LEFT JOIN therapists t
        ON t.id = s.therapist_id
      ORDER BY
        s.work_date ASC,
        s.start_time ASC
    `);

    res.json({
      success: true,
      schedules: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取排班失败"
    });
  }
});

app.post("/api/admin/schedules", adminAuth, async (req, res) => {
  try {
    const {
      therapist_id,
      therapistId,
      work_date,
      workDate,
      start_time,
      startTime,
      end_time,
      endTime
    } = req.body;

    const therapistIdValue = Number(
      therapist_id ?? therapistId
    );

    const workDateValue =
      work_date ?? workDate;

    const startTimeValue =
      start_time ?? startTime;

    const endTimeValue =
      end_time ?? endTime;

    if (
      !therapistIdValue ||
      !workDateValue ||
      !startTimeValue ||
      !endTimeValue
    ) {
      return res.status(400).json({
        success: false,
        message: "排班信息不完整"
      });
    }

    const result = await pool.query(`
      INSERT INTO therapist_schedules (
        therapist_id,
        work_date,
        start_time,
        end_time
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      therapistIdValue,
      workDateValue,
      startTimeValue,
      endTimeValue
    ]);

    res.json({
      success: true,
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "保存排班失败"
    });
  }
});

app.patch("/api/admin/schedules/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      therapist_id,
      therapistId,
      work_date,
      workDate,
      start_time,
      startTime,
      end_time,
      endTime
    } = req.body;

    const result = await pool.query(`
      UPDATE therapist_schedules
      SET
        therapist_id = COALESCE($1, therapist_id),
        work_date = COALESCE($2, work_date),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time)
      WHERE id = $5
      RETURNING *
    `, [
      therapist_id ?? therapistId ?? null,
      work_date ?? workDate ?? null,
      start_time ?? startTime ?? null,
      end_time ?? endTime ?? null,
      id
    ]);

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "排班不存在"
      });
    }

    res.json({
      success: true,
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "修改排班失败"
    });
  }
});

app.delete("/api/admin/schedules/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `
      DELETE FROM therapist_schedules
      WHERE id = $1
      `,
      [id]
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "删除排班失败"
    });
  }
});

/* ================================
   用户端：根据日期获取可预约疗愈师
================================ */

app.get("/api/available-therapists", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "请选择日期"
      });
    }

    const result = await pool.query(`
      SELECT DISTINCT
        t.id,
        t.name,
        t.avatar,
        t.bio,
        t.experience,
        t.specialties,
        t.is_active
      FROM therapists t
      INNER JOIN therapist_schedules s
        ON s.therapist_id = t.id
      WHERE
        t.is_active = TRUE
        AND s.work_date = $1
      ORDER BY t.id DESC
    `, [date]);

    res.json({
      success: true,
      therapists: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取可预约疗愈师失败"
    });
  }
});

/* ================================
   用户端：获取可预约时间
================================ */

app.get("/api/available-slots", async (req, res) => {
  try {
    const {
      therapistId,
      date,
      duration
    } = req.query;

    const therapistIdValue = Number(therapistId);
    const durationValue = Number(duration);

    if (
      !therapistIdValue ||
      !date ||
      ![90, 120].includes(durationValue)
    ) {
      return res.status(400).json({
        success: false,
        message: "参数错误"
      });
    }

    const scheduleResult = await pool.query(`
      SELECT
        start_time,
        end_time
      FROM therapist_schedules
      WHERE
        therapist_id = $1
        AND work_date = $2
      ORDER BY start_time
    `, [
      therapistIdValue,
      date
    ]);

    const orderResult = await pool.query(`
      SELECT
        service_time,
        duration,
        status
      FROM orders
      WHERE
        therapist_id = $1
        AND service_date = $2
        AND status <> '已取消'
    `, [
      therapistIdValue,
      date
    ]);

    function timeToMinutes(time) {
      const value = String(time).substring(0, 5);
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    }

    function minutesToTime(minutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;

      return (
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0")
      );
    }

    const booked = orderResult.rows.map(order => {
      const start = timeToMinutes(order.service_time);

      const durationNumber =
        Number.parseInt(order.duration, 10) || 90;

      return {
        start,
        end: start + durationNumber
      };
    });

    const slots = [];

    for (const schedule of scheduleResult.rows) {
      const start =
        timeToMinutes(schedule.start_time);

      const end =
        timeToMinutes(schedule.end_time);

      for (
        let current = start;
        current + durationValue <= end;
        current += 30
      ) {
        const slotEnd =
          current + durationValue;

        const conflict = booked.some(item => {
          return (
            current < item.end &&
            slotEnd > item.start
          );
        });

        if (!conflict) {
          slots.push(
            minutesToTime(current)
          );
        }
      }
    }

    res.json({
      success: true,
      slots
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取可预约时间失败"
    });
  }
});

/* ================================
   创建订单
================================ */

app.post("/api/orders", async (req, res) => {
  try {
    const {
      service,
      price,
      duration,
      therapist,
      therapistId,
      service_date,
      service_time,
      customer_name,
      phone,
      address
    } = req.body;

    if (
      !service ||
      !price ||
      !duration ||
      !therapist ||
      !therapistId ||
      !service_date ||
      !service_time ||
      !customer_name ||
      !phone ||
      !address
    ) {
      return res.status(400).json({
        success: false,
        message: "请填写完整预约信息"
      });
    }

    if (!/^1[3-9]\\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "请输入正确的手机号"
      });
    }

    const therapistResult = await pool.query(`
      SELECT
        id,
        name,
        is_active
      FROM therapists
      WHERE id = $1
      LIMIT 1
    `, [Number(therapistId)]);

    if (!therapistResult.rowCount) {
      return res.status(400).json({
        success: false,
        message: "疗愈师不存在"
      });
    }

    const therapistRow =
      therapistResult.rows[0];

    if (!therapistRow.is_active) {
      return res.status(400).json({
        success: false,
        message: "该疗愈师暂不可预约"
      });
    }

    const scheduleResult = await pool.query(`
      SELECT
        start_time,
        end_time
      FROM therapist_schedules
      WHERE
        therapist_id = $1
        AND work_date = $2
      LIMIT 1
    `, [
      Number(therapistId),
      service_date
    ]);

    if (!scheduleResult.rowCount) {
      return res.status(400).json({
        success: false,
        message: "该疗愈师当天没有排班"
      });
    }

    function timeToMinutes(time) {
      const value = String(time).substring(0, 5);
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    }

    const requestStart =
      timeToMinutes(service_time);

    const requestEnd =
      requestStart + Number(duration);

    const schedule =
      scheduleResult.rows[0];

    const scheduleStart =
      timeToMinutes(schedule.start_time);

    const scheduleEnd =
      timeToMinutes(schedule.end_time);

    if (
      requestStart < scheduleStart ||
      requestEnd > scheduleEnd
    ) {
      return res.status(400).json({
        success: false,
        message: "预约时间不在疗愈师排班范围内"
      });
    }

    const conflictResult = await pool.query(`
      SELECT
        service_time,
        duration
      FROM orders
      WHERE
        therapist_id = $1
        AND service_date = $2
        AND status <> '已取消'
    `, [
      Number(therapistId),
      service_date
    ]);

    const conflict =
      conflictResult.rows.some(order => {
        const existingStart =
          timeToMinutes(order.service_time);

        const existingDuration =
          Number.parseInt(order.duration, 10) || 90;

        const existingEnd =
          existingStart + existingDuration;

        return (
          requestStart < existingEnd &&
          requestEnd > existingStart
        );
      });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "该时间段已经被预约"
      });
    }

    const orderId =
      "YX" +
      Date.now() +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

    const result = await pool.query(`
      INSERT INTO orders (
        id,
        service,
        price,
        duration,
        therapist,
        therapist_id,
        service_date,
        service_time,
        customer_name,
        phone,
        address,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        '待确认'
      )
      RETURNING *
    `, [
      orderId,
      service,
      price,
      duration,
      therapist,
      Number(therapistId),
      service_date,
      service_time,
      customer_name,
      phone,
      address
    ]);

    res.json({
      success: true,
      message: "预约成功",
      order: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "预约失败，请稍后再试"
    });
  }
});

/* ================================
   后台订单
================================ */

app.get("/api/orders", adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        service,
        price,
        duration,
        therapist,
        therapist_id,
        service_date,
        service_time,
        customer_name,
        phone,
        address,
        status,
        created_at
      FROM orders
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "获取订单失败"
    });
  }
});

/* ================================
   修改订单状态
================================ */

app.patch("/api/orders/:id/status", adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;

    const result = await pool.query(`
      UPDATE orders
      SET status = $1
      WHERE id = $2
      RETURNING *
    `, [
      status,
      id
    ]);

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "订单不存在"
      });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "修改订单状态失败"
    });
  }
});

/* ================================
   删除订单
================================ */

app.delete("/api/orders/:id", adminAuth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM orders
      WHERE id = $1
      `,
      [req.params.id]
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "删除订单失败"
    });
  }
});

/* ================================
   首页
================================ */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

/* ================================
   启动
================================ */

async function startServer() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `奕心疗愈舍服务器运行在端口 ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "服务器启动失败：",
      error
    );

    process.exit(1);
  }
}

startServer();
