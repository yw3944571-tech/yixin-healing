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

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

const JWT_SECRET =
  process.env.JWT_SECRET;


// =========================
// PostgreSQL 数据库
// =========================

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }
});


// =========================
// 中间件
// =========================

app.use(
  express.json()
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// =========================
// 管理员验证
// =========================

function requireAdmin(
  req,
  res,
  next
) {

  const authHeader =
    req.headers.authorization;

  if (!authHeader) {

    return res.status(401).json({
      success: false,
      message:
        "请先登录管理员账号"
    });

  }

  const token =
    authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

  if (!token) {

    return res.status(401).json({
      success: false,
      message:
        "登录凭证无效"
    });

  }

  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.admin =
      decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message:
        "登录已过期，请重新登录"
    });

  }

}


// =========================
// 初始化数据库
// =========================

async function initDatabase() {

  try {

    // =========================
    // 订单表
    // =========================

    const ordersSql =
      "CREATE TABLE IF NOT EXISTS orders (" +
      "id VARCHAR(100) PRIMARY KEY," +
      "service VARCHAR(255) NOT NULL," +
      "price NUMERIC DEFAULT 0," +
      "duration VARCHAR(100)," +
      "therapist VARCHAR(255) NOT NULL," +
      "service_date VARCHAR(50) NOT NULL," +
      "service_time VARCHAR(50) NOT NULL," +
      "customer_name VARCHAR(255) NOT NULL," +
      "phone VARCHAR(50) NOT NULL," +
      "address TEXT NOT NULL," +
      "status VARCHAR(50) DEFAULT '待确认'," +
      "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP" +
      ")";

    await pool.query(
      ordersSql
    );


    // =========================
    // 疗愈师表
    // =========================

    const therapistsSql =
      "CREATE TABLE IF NOT EXISTS therapists (" +
      "id SERIAL PRIMARY KEY," +
      "name VARCHAR(255) NOT NULL UNIQUE," +
      "active BOOLEAN DEFAULT TRUE," +
      "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP" +
      ")";

    await pool.query(
      therapistsSql
    );


    // =========================
    // 疗愈师排班表
    // =========================

    const schedulesSql =
      "CREATE TABLE IF NOT EXISTS therapist_schedules (" +
      "id SERIAL PRIMARY KEY," +
      "therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE," +
      "work_date VARCHAR(50) NOT NULL," +
      "start_time VARCHAR(20) NOT NULL," +
      "end_time VARCHAR(20) NOT NULL," +
      "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP," +
      "UNIQUE (therapist_id, work_date)" +
      ")";

    await pool.query(
      schedulesSql
    );


    console.log(
      "PostgreSQL 数据库连接成功"
    );

    console.log(
      "orders 订单表已准备完成"
    );

    console.log(
      "therapists 疗愈师表已准备完成"
    );

    console.log(
      "therapist_schedules 排班表已准备完成"
    );


  } catch (error) {

    console.error(
      "PostgreSQL 初始化失败：",
      error
    );

    process.exit(1);

  }

}


// =========================
// 健康检查
// =========================

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await pool.query(
        "SELECT 1"
      );

      return res.json({
        success: true,
        message:
          "奕心疗愈舍服务器正常运行",
        database:
          "connected"
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "数据库连接失败",
        database:
          "disconnected"
      });

    }

  }
);


// =========================
// 管理员登录
// =========================

app.post(
  "/api/admin/login",
  (req, res) => {

    try {

      const {
        username,
        password
      } = req.body;


      if (
        !ADMIN_USERNAME ||
        !ADMIN_PASSWORD ||
        !JWT_SECRET
      ) {

        console.error(
          "管理员环境变量未设置"
        );

        return res.status(500).json({
          success: false,
          message:
            "服务器管理员配置错误"
        });

      }


      if (
        username !==
          ADMIN_USERNAME ||
        password !==
          ADMIN_PASSWORD
      ) {

        return res.status(401).json({
          success: false,
          message:
            "账号或密码错误"
        });

      }


      const token =
        jwt.sign(
          {
            username:
              ADMIN_USERNAME,

            role:
              "admin"
          },

          JWT_SECRET,

          {
            expiresIn:
              "7d"
          }
        );


      return res.json({
        success: true,
        message:
          "登录成功",
        token
      });


    } catch (error) {

      console.error(
        "管理员登录失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "登录失败"
      });

    }

  }
);


// =========================
// 客户端：获取启用中的疗愈师
// =========================

app.get(
  "/api/therapists",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT id, name FROM therapists " +
          "WHERE active = TRUE " +
          "ORDER BY id ASC"
        );


      return res.json({
        success: true,
        therapists:
          result.rows
      });


    } catch (error) {

      console.error(
        "获取疗愈师失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "获取疗愈师失败"
      });

    }

  }
);


// =========================
// 管理员：获取所有疗愈师
// =========================

app.get(
  "/api/admin/therapists",
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT id, name, active, created_at AS \"createdAt\" " +
          "FROM therapists " +
          "ORDER BY id ASC"
        );


      return res.json({
        success: true,
        therapists:
          result.rows
      });


    } catch (error) {

      console.error(
        "获取疗愈师失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "获取疗愈师失败"
      });

    }

  }
);


// =========================
// 管理员：新增疗愈师
// =========================

app.post(
  "/api/admin/therapists",
  requireAdmin,
  async (req, res) => {

    try {

      const name =
        String(
          req.body.name || ""
        ).trim();


      if (!name) {

        return res.status(400).json({
          success: false,
          message:
            "请输入疗愈师姓名"
        });

      }


      const result =
        await pool.query(
          "INSERT INTO therapists (name) " +
          "VALUES ($1) " +
          "RETURNING id, name, active",
          [name]
        );


      return res.json({
        success: true,
        message:
          "疗愈师添加成功",
        therapist:
          result.rows[0]
      });


    } catch (error) {

      if (
        error.code ===
        "23505"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "该疗愈师已经存在"
        });

      }


      console.error(
        "新增疗愈师失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "新增疗愈师失败"
      });

    }

  }
);


// =========================
// 管理员：修改疗愈师在岗状态
// =========================

app.patch(
  "/api/admin/therapists/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const therapistId =
        req.params.id;

      const active =
        Boolean(
          req.body.active
        );


      const result =
        await pool.query(
          "UPDATE therapists " +
          "SET active = $1 " +
          "WHERE id = $2 " +
          "RETURNING id, name, active",
          [
            active,
            therapistId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "疗愈师不存在"
        });

      }


      return res.json({
        success: true,
        message:
          "疗愈师状态已更新",
        therapist:
          result.rows[0]
      });


    } catch (error) {

      console.error(
        "修改疗愈师状态失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "修改疗愈师状态失败"
      });

    }

  }
);


// ======================================================
// 排班系统
// ======================================================


// =========================
// 管理员：获取全部排班
// =========================

app.get(
  "/api/admin/schedules",
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT " +
          "s.id, " +
          "s.therapist_id AS \"therapistId\", " +
          "t.name AS \"therapistName\", " +
          "s.work_date AS \"workDate\", " +
          "s.start_time AS \"startTime\", " +
          "s.end_time AS \"endTime\", " +
          "s.created_at AS \"createdAt\" " +
          "FROM therapist_schedules s " +
          "INNER JOIN therapists t " +
          "ON s.therapist_id = t.id " +
          "ORDER BY s.work_date ASC, s.start_time ASC, t.id ASC"
        );


      return res.json({
        success: true,
        schedules:
          result.rows
      });


    } catch (error) {

      console.error(
        "获取排班失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "获取排班失败"
      });

    }

  }
);


// =========================
// 管理员：新增排班
// =========================

app.post(
  "/api/admin/schedules",
  requireAdmin,
  async (req, res) => {

    try {

      const {
        therapistId,
        workDate,
        startTime,
        endTime
      } = req.body;


      if (!therapistId) {

        return res.status(400).json({
          success: false,
          message:
            "请选择疗愈师"
        });

      }


      if (!workDate) {

        return res.status(400).json({
          success: false,
          message:
            "请选择工作日期"
        });

      }


      if (!startTime) {

        return res.status(400).json({
          success: false,
          message:
            "请选择上班时间"
        });

      }


      if (!endTime) {

        return res.status(400).json({
          success: false,
          message:
            "请选择下班时间"
        });

      }


      if (
        startTime >=
        endTime
      ) {

        return res.status(400).json({
          success: false,
          message:
            "下班时间必须晚于上班时间"
        });

      }


      const therapistResult =
        await pool.query(
          "SELECT id, name, active " +
          "FROM therapists " +
          "WHERE id = $1",
          [therapistId]
        );


      if (
        therapistResult.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "疗愈师不存在"
        });

      }


      if (
        therapistResult.rows[0].active !== true
      ) {

        return res.status(400).json({
          success: false,
          message:
            "该疗愈师目前已停用"
        });

      }


      const result =
        await pool.query(
          "INSERT INTO therapist_schedules " +
          "(therapist_id, work_date, start_time, end_time) " +
          "VALUES ($1, $2, $3, $4) " +
          "RETURNING id, therapist_id AS \"therapistId\", " +
          "work_date AS \"workDate\", " +
          "start_time AS \"startTime\", " +
          "end_time AS \"endTime\"",
          [
            therapistId,
            workDate,
            startTime,
            endTime
          ]
        );


      return res.json({
        success: true,
        message:
          "排班添加成功",
        schedule:
          result.rows[0]
      });


    } catch (error) {

      if (
        error.code ===
        "23505"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "该疗愈师当天已经有排班，请修改原排班"
        });

      }


      console.error(
        "新增排班失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "新增排班失败"
      });

    }

  }
);


// =========================
// 管理员：修改排班
// =========================

app.patch(
  "/api/admin/schedules/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const scheduleId =
        req.params.id;

      const {
        therapistId,
        workDate,
        startTime,
        endTime
      } = req.body;


      if (!therapistId) {

        return res.status(400).json({
          success: false,
          message:
            "请选择疗愈师"
        });

      }


      if (!workDate) {

        return res.status(400).json({
          success: false,
          message:
            "请选择工作日期"
        });

      }


      if (!startTime) {

        return res.status(400).json({
          success: false,
          message:
            "请选择上班时间"
        });

      }


      if (!endTime) {

        return res.status(400).json({
          success: false,
          message:
            "请选择下班时间"
        });

      }


      if (
        startTime >=
        endTime
      ) {

        return res.status(400).json({
          success: false,
          message:
            "下班时间必须晚于上班时间"
        });

      }


      const result =
        await pool.query(
          "UPDATE therapist_schedules " +
          "SET therapist_id = $1, " +
          "work_date = $2, " +
          "start_time = $3, " +
          "end_time = $4 " +
          "WHERE id = $5 " +
          "RETURNING id, " +
          "therapist_id AS \"therapistId\", " +
          "work_date AS \"workDate\", " +
          "start_time AS \"startTime\", " +
          "end_time AS \"endTime\"",
          [
            therapistId,
            workDate,
            startTime,
            endTime,
            scheduleId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "排班不存在"
        });

      }


      return res.json({
        success: true,
        message:
          "排班修改成功",
        schedule:
          result.rows[0]
      });


    } catch (error) {

      if (
        error.code ===
        "23505"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "该疗愈师当天已经有排班"
        });

      }


      console.error(
        "修改排班失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "修改排班失败"
      });

    }

  }
);


// =========================
// 管理员：删除排班
// =========================

app.delete(
  "/api/admin/schedules/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const scheduleId =
        req.params.id;


      const result =
        await pool.query(
          "DELETE FROM therapist_schedules " +
          "WHERE id = $1 " +
          "RETURNING id",
          [scheduleId]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "排班不存在"
        });

      }


      return res.json({
        success: true,
        message:
          "排班删除成功"
      });


    } catch (error) {

      console.error(
        "删除排班失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "删除排班失败"
      });

    }

  }
);


// =========================
// 客户端：查询某天工作的疗愈师
// =========================

app.get(
  "/api/available-therapists",
  async (req, res) => {

    try {

      const {
        date
      } = req.query;


      if (!date) {

        return res.status(400).json({
          success: false,
          message:
            "请选择日期"
        });

      }


      const result =
        await pool.query(
          "SELECT DISTINCT " +
          "t.id, " +
          "t.name, " +
          "s.start_time AS \"startTime\", " +
          "s.end_time AS \"endTime\" " +
          "FROM therapists t " +
          "INNER JOIN therapist_schedules s " +
          "ON t.id = s.therapist_id " +
          "WHERE t.active = TRUE " +
          "AND s.work_date = $1 " +
          "ORDER BY t.id ASC",
          [date]
        );


      return res.json({
        success: true,
        date,
        therapists:
          result.rows
      });


    } catch (error) {

      console.error(
        "查询可用疗愈师失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "查询可用疗愈师失败"
      });

    }

  }
);


// =========================
// 客户端：查询疗愈师可预约时间
// =========================

app.get(
  "/api/available-slots",
  async (req, res) => {

    try {

      const {
        therapistId,
        date,
        duration
      } = req.query;


      if (!therapistId) {

        return res.status(400).json({
          success: false,
          message:
            "请选择疗愈师"
        });

      }


      if (!date) {

        return res.status(400).json({
          success: false,
          message:
            "请选择日期"
        });

      }


      const serviceDuration =
        Number(duration) || 90;


      if (
        serviceDuration !== 90 &&
        serviceDuration !== 120
      ) {

        return res.status(400).json({
          success: false,
          message:
            "服务时长只能是90分钟或120分钟"
        });

      }


      // 获取当天排班

      const scheduleResult =
        await pool.query(
          "SELECT start_time AS \"startTime\", " +
          "end_time AS \"endTime\" " +
          "FROM therapist_schedules " +
          "WHERE therapist_id = $1 " +
          "AND work_date = $2 " +
          "LIMIT 1",
          [
            therapistId,
            date
          ]
        );


      if (
        scheduleResult.rows.length === 0
      ) {

        return res.json({
          success: true,
          slots: []
        });

      }


      const schedule =
        scheduleResult.rows[0];


      // 获取当天已经预约的时间

      const ordersResult =
        await pool.query(
          "SELECT service_time AS \"serviceTime\", " +
          "duration, status " +
          "FROM orders " +
          "WHERE therapist = (" +
          "SELECT name FROM therapists WHERE id = $1" +
          ") " +
          "AND service_date = $2 " +
          "AND status <> '已取消'",
          [
            therapistId,
            date
          ]
        );


      const bookedOrders =
        ordersResult.rows;


      function timeToMinutes(
        time
      ) {

        const parts =
          String(time)
            .split(":")
            .map(Number);

        return (
          parts[0] * 60 +
          parts[1]
        );

      }


      function minutesToTime(
        minutes
      ) {

        const hour =
          Math.floor(
            minutes / 60
          );

        const minute =
          minutes % 60;

        return (
          String(hour).padStart(2, "0") +
          ":" +
          String(minute).padStart(2, "0")
        );

      }


      const startMinutes =
        timeToMinutes(
          schedule.startTime
        );

      const endMinutes =
        timeToMinutes(
          schedule.endTime
        );


      const slots = [];

      // 默认每30分钟一个预约起点

      for (
        let current = startMinutes;
        current + serviceDuration <= endMinutes;
        current += 30
      ) {

        const slotStart =
          current;

        const slotEnd =
          current +
          serviceDuration;


        let available = true;


        // 检查是否与已有订单冲突

        for (
          const order
          of bookedOrders
        ) {

          const bookedStart =
            timeToMinutes(
              order.serviceTime
            );

          const bookedDuration =
            Number(
              String(
                order.duration || "90"
              )
                .replace(
                  /[^0-9]/g,
                  ""
                )
            ) || 90;

          const bookedEnd =
            bookedStart +
            bookedDuration;


          if (
            slotStart < bookedEnd &&
            slotEnd > bookedStart
          ) {

            available = false;

            break;

          }

        }


        if (available) {

          slots.push({
            time:
              minutesToTime(
                slotStart
              ),

            duration:
              serviceDuration,

            available:
              true
          });

        }

      }


      return res.json({
        success: true,
        therapistId,
        date,
        duration:
          serviceDuration,
        slots
      });


    } catch (error) {

      console.error(
        "查询可预约时间失败：",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "查询可预约时间失败"
      });

    }

  }
);


// =========================
// 创建订单
// =========================

app.post(
  "/api/orders",
  async (req, res) => {

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


      if (!service) {

        return res.status(400).json({
          success:false,
          message:"请选择疗愈服务"
        });

      }


      if (!therapist) {

        return res.status(400).json({
          success:false,
          message:"请选择疗愈师"
        });

      }


      if (!date) {

        return res.status(400).json({
          success:false,
          message:"请选择服务日期"
        });

      }


      if (!time) {

        return res.status(400).json({
          success:false,
          message:"请选择服务时间"
        });

      }


      if (!name) {

        return res.status(400).json({
          success:false,
          message:"请输入姓名"
        });

      }


      if (!phone) {

        return res.status(400).json({
          success:false,
          message:"请输入手机号"
        });

      }


      const phoneRegex =
        /^1[3-9]\d{9}$/;


      if (
        !phoneRegex.test(phone)
      ) {

        return res.status(400).json({
          success:false,
          message:"手机号格式不正确"
        });

      }


      if (!address) {

        return res.status(400).json({
          success:false,
          message:"请输入服务地址"
        });

      }


      // =========================
      // 检查疗愈师
      // =========================

      const therapistResult =
        await pool.query(
          "SELECT id, name, active " +
          "FROM therapists " +
          "WHERE name = $1",
          [therapist]
        );


      if (
        therapistResult.rows.length === 0
      ) {

        return res.status(400).json({
          success:false,
          message:"该疗愈师不存在"
        });

      }


      if (
        therapistResult.rows[0].active !== true
      ) {

        return res.status(400).json({
          success:false,
          message:
            "该疗愈师目前暂停接单，请选择其他疗愈师"
        });

      }


      const therapistId =
        therapistResult.rows[0].id;


      // =========================
      // 检查当天是否排班
      // =========================

      const scheduleResult =
        await pool.query(
          "SELECT start_time, end_time " +
          "FROM therapist_schedules " +
          "WHERE therapist_id = $1 " +
          "AND work_date = $2 " +
          "LIMIT 1",
          [
            therapistId,
            date
          ]
        );


      if (
        scheduleResult.rows.length === 0
      ) {

        return res.status(400).json({
          success:false,
          message:
            "该疗愈师当天没有排班"
        });

      }


      const schedule =
        scheduleResult.rows[0];


      function timeToMinutes(
        value
      ) {

        const parts =
          String(value)
            .split(":")
            .map(Number);

        return (
          parts[0] * 60 +
          parts[1]
        );

      }


      const startMinutes =
        timeToMinutes(
          schedule.start_time
        );

      const endMinutes =
        timeToMinutes(
          schedule.end_time
        );

      const orderStart =
        timeToMinutes(
          time
        );


      const serviceDuration =
        Number(duration) || 90;


      const orderEnd =
        orderStart +
        serviceDuration;


      // 检查预约是否在工作时间内

      if (
        orderStart <
        startMinutes ||
        orderEnd >
        endMinutes
      ) {

        return res.status(400).json({
          success:false,
          message:
            "该预约时间超出疗愈师当天工作时间"
        });

      }


      // =========================
      // 检查重复预约
      // =========================

      const conflictResult =
        await pool.query(
          "SELECT id, service_time, duration " +
          "FROM orders " +
          "WHERE therapist = $1 " +
          "AND service_date = $2 " +
          "AND status <> '已取消'",
          [
            therapist,
            date
          ]
        );


      for (
        const order
        of conflictResult.rows
      ) {

        const existingStart =
          timeToMinutes(
            order.service_time
          );

        const existingDuration =
          Number(
            String(
              order.duration || "90"
            )
              .replace(
                /[^0-9]/g,
                ""
              )
          ) || 90;

        const existingEnd =
          existingStart +
          existingDuration;


        if (
          orderStart <
          existingEnd &&
          orderEnd >
          existingStart
        ) {

          return res.status(409).json({
            success:false,
            message:
              "该疗愈师这个时间已经被预约，请重新选择其他时间"
          });

        }

      }


      // =========================
      // 创建订单
      // =========================

      const orderId =
        "YX" +
        Date.now() +
        Math.floor(
          Math.random() * 1000
        );


      const insertSql =
        "INSERT INTO orders (" +
        "id, service, price, duration, therapist, " +
        "service_date, service_time, customer_name, " +
        "phone, address, status" +
        ") VALUES (" +
        "$1, $2, $3, $4, $5, " +
        "$6, $7, $8, $9, $10, $11" +
        ")";


      await pool.query(
        insertSql,
        [
          orderId,
          service,
          Number(price) || 0,
          duration || "90",
          therapist,
          date,
          time,
          name,
          phone,
          address,
          "待确认"
        ]
      );


      return res.json({
        success:true,
        message:"预约成功",
        orderId
      });


    } catch (error) {

      console.error(
        "创建订单失败：",
        error
      );


      return res.status(500).json({
        success:false,
        message:
          "预约失败，请稍后再试"
      });

    }

  }
);


// =========================
// 获取订单
// =========================

app.get(
  "/api/orders",
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT " +
          "id, service, price, duration, therapist, " +
          "service_date AS date, " +
          "service_time AS time, " +
          "customer_name AS name, " +
          "phone, address, status, " +
          "created_at AS \"createdAt\" " +
          "FROM orders " +
          "ORDER BY service_date ASC, service_time ASC, created_at DESC"
        );


      return res.json({
        success:true,
        orders:
          result.rows
      });


    } catch (error) {

      console.error(
        "获取订单失败：",
        error
      );


      return res.status(500).json({
        success:false,
        message:
          "获取订单失败"
      });

    }

  }
);


// =========================
// 修改订单状态
// =========================

app.patch(
  "/api/orders/:id/status",
  requireAdmin,
  async (req, res) => {

    try {

      const orderId =
        req.params.id;

      const status =
        req.body.status;


      const allowedStatuses = [
        "待确认",
        "已确认",
        "服务中",
        "已完成",
        "已取消"
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({
          success:false,
          message:
            "无效的订单状态"
        });

      }


      const result =
        await pool.query(
          "UPDATE orders " +
          "SET status = $1 " +
          "WHERE id = $2 " +
          "RETURNING id, status",
          [
            status,
            orderId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success:false,
          message:
            "订单不存在"
        });

      }


      return res.json({
        success:true,
        message:
          "订单状态更新成功",
        order:
          result.rows[0]
      });


    } catch (error) {

      console.error(
        "修改订单状态失败：",
        error
      );


      return res.status(500).json({
        success:false,
        message:
          "修改订单状态失败"
      });

    }

  }
);


// =========================
// 删除订单
// =========================

app.delete(
  "/api/orders/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const orderId =
        req.params.id;


      const result =
        await pool.query(
          "DELETE FROM orders " +
          "WHERE id = $1 " +
          "RETURNING id",
          [orderId]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success:false,
          message:
            "订单不存在"
        });

      }


      return res.json({
        success:true,
        message:
          "订单删除成功"
      });


    } catch (error) {

      console.error(
        "删除订单失败：",
        error
      );


      return res.status(500).json({
        success:false,
        message:
          "删除订单失败"
      });

    }

  }
);


// =========================
// 页面
// =========================

app.get(
  "*",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


// =========================
// 启动
// =========================

async function startServer() {

  await initDatabase();


  app.listen(
    PORT,
    () => {

      console.log(
        "奕心疗愈舍服务器已启动，端口：" +
        PORT
      );

    }
  );

}


startServer();
