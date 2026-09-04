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

// 获取启用中的疗愈师

// 客户预约页面使用

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





      // =========================

      // 基础验证

      // =========================



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





      if (!date) {



        return res.status(400).json({

          success: false,

          message:

            "请选择服务日期"

        });



      }





      if (!time) {



        return res.status(400).json({

          success: false,

          message:

            "请选择服务时间"

        });



      }





      if (!name) {



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

        !phoneRegex.test(

          phone

        )

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





      // =========================

      // 检查疗愈师是否存在

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

          success: false,

          message:

            "该疗愈师不存在"

        });



      }





      if (

        therapistResult.rows[0]

          .active !== true

      ) {



        return res.status(400).json({

          success: false,

          message:

            "该疗愈师目前暂停接单，请选择其他疗愈师"

        });



      }





      // =========================

      // 检查重复预约

      //

      // 只有非取消订单占用时间

      // =========================



      const conflictResult =

        await pool.query(

          "SELECT id " +

          "FROM orders " +

          "WHERE therapist = $1 " +

          "AND service_date = $2 " +

          "AND service_time = $3 " +

          "AND status <> '已取消' " +

          "LIMIT 1",

          [

            therapist,

            date,

            time

          ]

        );





      if (

        conflictResult.rows.length > 0

      ) {



        return res.status(409).json({

          success: false,

          message:

            "该疗愈师这个时间已经被预约，请重新选择其他时间"

        });



      }





      // =========================

      // 创建订单号

      // =========================



      const orderId =

        "YX" +

        Date.now() +

        Math.floor(

          Math.random() * 1000

        );





      const order = {



        id:

          orderId,



        service,



        price:

          Number(price) || 0,



        duration,



        therapist,



        date,



        time,



        name,



        phone,



        address,



        status:

          "待确认"



      };





      // =========================

      // 写入数据库

      // =========================



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





      console.log(

        "收到新预约订单：",

        order

      );





      return res.json({

        success: true,

        message:

          "预约提交成功",

        order

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

        "RETURNING id, status";





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

          [orderId]

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
