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



const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const JWT_SECRET = process.env.JWT_SECRET;



// =========================

// PostgreSQL 数据库

// =========================



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



app.use(

  express.static(

    path.join(__dirname, "public")

  )

);



// =========================

// 管理员验证

// =========================



function requireAdmin(req, res, next) {



  const authHeader =

    req.headers.authorization;



  if (!authHeader) {



    return res.status(401).json({

      success: false,

      message: "请先登录管理员账号"

    });



  }



  const token =

    authHeader.startsWith("Bearer ")

      ? authHeader.substring(7)

      : null;



  if (!token) {



    return res.status(401).json({

      success: false,

      message: "登录凭证无效"

    });



  }



  try {



    const decoded =

      jwt.verify(

        token,

        JWT_SECRET

      );



    req.admin = decoded;



    next();



  } catch (error) {



    return res.status(401).json({

      success: false,

      message: "登录已过期，请重新登录"

    });



  }



}



// =========================

// 初始化数据库

// =========================



async function initDatabase() {



  try {



    // -------------------------

    // 订单表

    // -------------------------



    const ordersSql =

      "CREATE TABLE IF NOT EXISTS orders (" +

      "id VARCHAR(100) PRIMARY KEY," +

      "service VARCHAR(255) NOT NULL," +

      "price NUMERIC DEFAULT 0," +

      "duration VARCHAR(100)," +

      "therapist VARCHAR(255) NOT NULL," +

      "therapist_id INTEGER," +

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



    // 为旧数据库增加 therapist_id

    await pool.query(

      "ALTER TABLE orders " +

      "ADD COLUMN IF NOT EXISTS therapist_id INTEGER"

    );





    // -------------------------

    // 疗愈师表

    // -------------------------



    const therapistsSql =

      "CREATE TABLE IF NOT EXISTS therapists (" +

      "id SERIAL PRIMARY KEY," +

      "name VARCHAR(100) NOT NULL," +

      "avatar TEXT," +

      "bio TEXT," +

      "experience VARCHAR(255)," +

      "specialties TEXT," +

      "is_active BOOLEAN DEFAULT TRUE," +

      "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP" +

      ")";



    await pool.query(

      therapistsSql

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



        return res.status(500).json({

          success: false,

          message:

            "服务器管理员配置错误"

        });



      }





      if (

        username !== ADMIN_USERNAME ||

        password !== ADMIN_PASSWORD

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

        message: "登录成功",

        token

      });



    } catch (error) {



      console.error(

        "管理员登录失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message: "登录失败"

      });



    }



  }

);



// =================================================

// 疗愈师 API

// =================================================





// =========================

// 获取全部疗愈师

// 管理后台

// =========================



app.get(

  "/api/therapists",

  requireAdmin,

  async (req, res) => {



    try {



      const result =

        await pool.query(

          "SELECT " +

          "id, " +

          "name, " +

          "avatar, " +

          "bio, " +

          "experience, " +

          "specialties, " +

          "is_active AS \"isActive\", " +

          "created_at AS \"createdAt\" " +

          "FROM therapists " +

          "ORDER BY id DESC"

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

// 添加疗愈师

// =========================



app.post(

  "/api/therapists",

  requireAdmin,

  async (req, res) => {



    try {



      const {

        name,

        avatar,

        bio,

        experience,

        specialties,

        isActive

      } = req.body;





      if (

        !name ||

        !name.trim()

      ) {



        return res.status(400).json({

          success: false,

          message:

            "请输入疗愈师姓名"

        });



      }





      const result =

        await pool.query(

          "INSERT INTO therapists (" +

          "name, avatar, bio, experience, specialties, is_active" +

          ") VALUES (" +

          "$1, $2, $3, $4, $5, $6" +

          ") RETURNING " +

          "id, name, avatar, bio, experience, specialties, " +

          "is_active AS \"isActive\", " +

          "created_at AS \"createdAt\"",

          [

            name.trim(),

            avatar || "",

            bio || "",

            experience || "",

            specialties || "",

            isActive !== false

          ]

        );





      return res.json({

        success: true,

        message:

          "疗愈师添加成功",

        therapist:

          result.rows[0]

      });



    } catch (error) {



      console.error(

        "添加疗愈师失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "添加疗愈师失败"

      });



    }



  }

);





// =========================

// 修改疗愈师

// =========================



app.put(

  "/api/therapists/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const therapistId =

        Number(req.params.id);





      const {

        name,

        avatar,

        bio,

        experience,

        specialties,

        isActive

      } = req.body;





      if (

        !therapistId

      ) {



        return res.status(400).json({

          success: false,

          message:

            "疗愈师 ID 无效"

        });



      }





      if (

        !name ||

        !name.trim()

      ) {



        return res.status(400).json({

          success: false,

          message:

            "请输入疗愈师姓名"

        });



      }





      const result =

        await pool.query(

          "UPDATE therapists " +

          "SET " +

          "name = $1, " +

          "avatar = $2, " +

          "bio = $3, " +

          "experience = $4, " +

          "specialties = $5, " +

          "is_active = $6 " +

          "WHERE id = $7 " +

          "RETURNING " +

          "id, name, avatar, bio, experience, specialties, " +

          "is_active AS \"isActive\", " +

          "created_at AS \"createdAt\"",

          [

            name.trim(),

            avatar || "",

            bio || "",

            experience || "",

            specialties || "",

            isActive !== false,

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

          "疗愈师资料已更新",

        therapist:

          result.rows[0]

      });



    } catch (error) {



      console.error(

        "修改疗愈师失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "修改疗愈师失败"

      });



    }



  }

);





// =========================

// 删除疗愈师

// =========================



app.delete(

  "/api/therapists/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const therapistId =

        Number(req.params.id);





      const result =

        await pool.query(

          "DELETE FROM therapists " +

          "WHERE id = $1 " +

          "RETURNING id",

          [

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

          "疗愈师已删除"

      });



    } catch (error) {



      console.error(

        "删除疗愈师失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "删除疗愈师失败"

      });



    }



  }

);





// =================================================

// 预约页面 API

// =================================================





// =========================

// 获取可预约疗愈师

// =========================



app.get(

  "/api/available-therapists",

  async (req, res) => {



    try {



      const result =

        await pool.query(

          "SELECT " +

          "id, " +

          "name, " +

          "avatar, " +

          "bio, " +

          "experience, " +

          "specialties " +

          "FROM therapists " +

          "WHERE is_active = TRUE " +

          "ORDER BY id DESC"

        );





      return res.json({

        success: true,

        therapists:

          result.rows

      });



    } catch (error) {



      console.error(

        "获取可预约疗愈师失败：",

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

// 获取可预约时间

// =========================



app.get(

  "/api/available-slots",

  async (req, res) => {



    try {



      const therapistId =

        Number(

          req.query.therapistId

        );





      const date =

        req.query.date;





      const duration =

        Number(

          req.query.duration

        );





      if (

        !therapistId ||

        !date

      ) {



        return res.status(400).json({

          success: false,

          message:

            "疗愈师或日期不能为空"

        });



      }





      const allSlots = [

        "10:00",

        "11:00",

        "12:00",

        "13:00",

        "14:00",

        "15:00",

        "16:00",

        "17:00",

        "18:00",

        "19:00",

        "20:00"

      ];





      const result =

        await pool.query(

          "SELECT service_time " +

          "FROM orders " +

          "WHERE therapist_id = $1 " +

          "AND service_date = $2 " +

          "AND status NOT IN ('已取消')",

          [

            therapistId,

            date

          ]

        );





      const bookedTimes =

        result.rows.map(

          item =>

            item.service_time

        );





      const slots =

        allSlots.map(

          time => {



            return {

              time:

                time,



              available:

                !bookedTimes.includes(

                  time

                ),



              disabled:

                bookedTimes.includes(

                  time

                )

            };



          }

        );





      return res.json({

        success: true,

        date,

        therapistId,

        duration,

        slots

      });



    } catch (error) {



      console.error(

        "获取可预约时间失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "获取可预约时间失败"

      });



    }



  }

);





// =================================================

// 订单 API

// =================================================





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

        therapistId,

        date,

        time,

        service_date,

        service_time,

        customer_name,

        name,

        phone,

        address

      } = req.body;





      const finalDate =

        service_date ||

        date;





      const finalTime =

        service_time ||

        time;





      const finalName =

        customer_name ||

        name;





      if (!service) {



        return res.status(400).json({

          success: false,

          message:

            "请选择疗愈服务"

        });



      }





      if (!therapist) {



        return res.status(400).json({

          success: false,

          message:

            "请选择疗愈师"

        });



      }





      if (!therapistId) {



        return res.status(400).json({

          success: false,

          message:

            "疗愈师信息无效"

        });



      }





      if (!finalDate) {



        return res.status(400).json({

          success: false,

          message:

            "请选择服务日期"

        });



      }





      if (!finalTime) {



        return res.status(400).json({

          success: false,

          message:

            "请选择服务时间"

        });



      }





      if (!finalName) {



        return res.status(400).json({

          success: false,

          message:

            "请输入姓名"

        });



      }





      if (!phone) {



        return res.status(400).json({

          success: false,

          message:

            "请输入手机号"

        });



      }





      const phoneRegex =

        /^1[3-9]\d{9}$/;





      if (

        !phoneRegex.test(phone)

      ) {



        return res.status(400).json({

          success: false,

          message:

            "手机号格式不正确"

        });



      }





      if (!address) {



        return res.status(400).json({

          success: false,

          message:

            "请输入服务地址"

        });



      }





      // -------------------------

      // 确认疗愈师存在且可预约

      // -------------------------



      const therapistCheck =

        await pool.query(

          "SELECT id, name " +

          "FROM therapists " +

          "WHERE id = $1 " +

          "AND is_active = TRUE",

          [

            Number(

              therapistId

            )

          ]

        );





      if (

        therapistCheck.rows.length === 0

      ) {



        return res.status(400).json({

          success: false,

          message:

            "该疗愈师当前不可预约"

        });



      }





      // -------------------------

      // 防止重复预约

      // -------------------------



      const conflictCheck =

        await pool.query(

          "SELECT id " +

          "FROM orders " +

          "WHERE therapist_id = $1 " +

          "AND service_date = $2 " +

          "AND service_time = $3 " +

          "AND status NOT IN ('已取消')",

          [

            Number(

              therapistId

            ),

            finalDate,

            finalTime

          ]

        );





      if (

        conflictCheck.rows.length > 0

      ) {



        return res.status(409).json({

          success: false,

          message:

            "该时间已被其他客户预约，请重新选择"

        });



      }





      const orderId =

        "YX" +

        Date.now() +

        Math.floor(

          Math.random() * 1000

        );





      const insertSql =

        "INSERT INTO orders (" +

        "id, service, price, duration, therapist, therapist_id, " +

        "service_date, service_time, customer_name, " +

        "phone, address, status" +

        ") VALUES (" +

        "$1, $2, $3, $4, $5, $6, " +

        "$7, $8, $9, $10, $11, $12" +

        ") RETURNING " +

        "id, service, price, duration, therapist, therapist_id, " +

        "service_date AS \"date\", " +

        "service_time AS \"time\", " +

        "customer_name AS \"name\", " +

        "phone, address, status, " +

        "created_at AS \"createdAt\"";





      const result =

        await pool.query(

          insertSql,

          [

            orderId,

            service,

            Number(price) || 0,

            String(duration || ""),

            therapistCheck.rows[0].name,

            Number(therapistId),

            finalDate,

            finalTime,

            finalName,

            phone,

            address,

            "待确认"

          ]

        );





      console.log(

        "收到新预约订单：",

        result.rows[0]

      );





      return res.json({

        success: true,

        message:

          "预约提交成功",

        order:

          result.rows[0]

      });



    } catch (error) {



      console.error(

        "创建订单失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "服务器处理失败"

      });



    }



  }

);





// =========================

// 获取所有订单

// =========================



app.get(

  "/api/orders",

  requireAdmin,

  async (req, res) => {



    try {



      const selectSql =

        "SELECT " +

        "id, " +

        "service, " +

        "price, " +

        "duration, " +

        "therapist, " +

        "therapist_id AS \"therapistId\", " +

        "service_date AS \"date\", " +

        "service_time AS \"time\", " +

        "customer_name AS \"name\", " +

        "phone, " +

        "address, " +

        "status, " +

        "created_at AS \"createdAt\" " +

        "FROM orders " +

        "ORDER BY created_at DESC";





      const result =

        await pool.query(

          selectSql

        );





      return res.json({

        success: true,

        total:

          result.rows.length,

        orders:

          result.rows

      });



    } catch (error) {



      console.error(

        "获取订单失败：",

        error

      );



      return res.status(500).json({

        success: false,

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





      const allowedStatus = [

        "待确认",

        "已确认",

        "服务中",

        "已完成",

        "已取消"

      ];





      if (

        !allowedStatus.includes(

          status

        )

      ) {



        return res.status(400).json({

          success: false,

          message:

            "订单状态不合法"

        });



      }





      const updateSql =

        "UPDATE orders " +

        "SET status = $1 " +

        "WHERE id = $2 " +

        "RETURNING " +

        "id, status";





      const result =

        await pool.query(

          updateSql,

          [

            status,

            orderId

          ]

        );





      if (

        result.rows.length === 0

      ) {



        return res.status(404).json({

          success: false,

          message:

            "订单不存在"

        });



      }





      console.log(

        "订单状态已更新：",

        orderId,

        status

      );





      return res.json({

        success: true,

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

        success: false,

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

          [

            orderId

          ]

        );





      if (

        result.rows.length === 0

      ) {



        return res.status(404).json({

          success: false,

          message:

            "订单不存在"

        });



      }





      return res.json({

        success: true,

        message:

          "订单已删除"

      });



    } catch (error) {



      console.error(

        "删除订单失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "删除订单失败"

      });



    }



  }

);





// =========================

// 启动服务器

// =========================



async function startServer() {



  await initDatabase();



  app.listen(

    PORT,

    () => {



      console.log(

        "奕心疗愈舍服务器运行在端口 " +

        PORT

      );



    }

  );



}



startServer();
