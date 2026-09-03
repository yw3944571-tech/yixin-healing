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





// =================================================

// PostgreSQL

// =================================================



const pool = new Pool({

  connectionString: process.env.DATABASE_URL,



  ssl: process.env.DATABASE_URL

    ? {

        rejectUnauthorized: false

      }

    : false

});





// =================================================

// 中间件

// =================================================



app.use(

  express.json({

    limit: "5mb"

  })

);



app.use(

  express.urlencoded({

    extended: true,

    limit: "5mb"

  })

);



app.use(

  express.static(

    path.join(__dirname, "public")

  )

);





// =================================================

// 管理员验证

// =================================================



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





// =================================================

// 数据库初始化

// =================================================



async function initDatabase() {



  try {



    // =============================================

    // orders

    // =============================================



    await pool.query(`

      CREATE TABLE IF NOT EXISTS orders (

        id VARCHAR(100) PRIMARY KEY,

        service VARCHAR(255) NOT NULL,

        price NUMERIC DEFAULT 0,

        duration VARCHAR(100),

        therapist VARCHAR(255) NOT NULL,

        therapist_id INTEGER,

        service_date VARCHAR(50) NOT NULL,

        service_time VARCHAR(50) NOT NULL,

        customer_name VARCHAR(255) NOT NULL,

        phone VARCHAR(50) NOT NULL,

        address TEXT NOT NULL,

        status VARCHAR(50) DEFAULT '待确认',

        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

      )

    `);





    // =============================================

    // therapists

    // =============================================



    await pool.query(`

      CREATE TABLE IF NOT EXISTS therapists (

        id SERIAL PRIMARY KEY,

        name VARCHAR(100) NOT NULL,

        avatar TEXT,

        bio TEXT,

        experience VARCHAR(255),

        specialties TEXT,

        is_active BOOLEAN DEFAULT TRUE,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

      )

    `);





    // =============================================

    // therapists 新字段

    // =============================================



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS title VARCHAR(100)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS return_rate INTEGER DEFAULT 0

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS satisfaction INTEGER DEFAULT 0

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS service_count INTEGER DEFAULT 0

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS nationality VARCHAR(50)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS education VARCHAR(50)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS height VARCHAR(20)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS weight VARCHAR(20)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 5.0

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS gender VARCHAR(20)

    `);



    await pool.query(`

      ALTER TABLE therapists

      ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT FALSE

    `);





    // =============================================

    // orders 兼容

    // =============================================



    await pool.query(`

      ALTER TABLE orders

      ADD COLUMN IF NOT EXISTS therapist_id INTEGER

    `);





    // =============================================

    // 排班表

    // =============================================



    await pool.query(`

      CREATE TABLE IF NOT EXISTS therapist_schedules (

        id SERIAL PRIMARY KEY,

        therapist_id INTEGER NOT NULL,

        work_date VARCHAR(50) NOT NULL,

        start_time VARCHAR(20) NOT NULL,

        end_time VARCHAR(20) NOT NULL,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (therapist_id, work_date)

      )

    `);





    // =============================================

    // 删除旧姓名唯一限制

    // =============================================



    await pool.query(`

      ALTER TABLE therapists

      DROP CONSTRAINT IF EXISTS therapists_name_key

    `);



    await pool.query(`

      DROP INDEX IF EXISTS therapists_name_key

    `);





    console.log("================================");

    console.log("PostgreSQL 数据库连接成功");

    console.log("orders 表已准备完成");

    console.log("therapists 表已准备完成");

    console.log("therapist_schedules 表已准备完成");

    console.log("疗愈师资料字段升级完成");

    console.log("数据库初始化完成");

    console.log("================================");



  } catch (error) {



    console.error(

      "数据库初始化失败：",

      error

    );



    process.exit(1);



  }



}





// =================================================

// 工具：时间转换

// =================================================



function timeToMinutes(time) {



  if (!time) {

    return 0;

  }



  const parts =

    String(time)

      .split(":")

      .map(Number);



  const hour =

    Number(parts[0] || 0);



  const minute =

    Number(parts[1] || 0);



  return hour * 60 + minute;



}





function minutesToTime(minutes) {



  const hour =

    Math.floor(minutes / 60);



  const minute =

    minutes % 60;



  return (

    String(hour).padStart(2, "0") +

    ":" +

    String(minute).padStart(2, "0")

  );



}





function isTimeOverlap(

  startA,

  durationA,

  startB,

  durationB

) {



  const aStart =

    timeToMinutes(startA);



  const aEnd =

    aStart + Number(durationA || 0);



  const bStart =

    timeToMinutes(startB);



  const bEnd =

    bStart + Number(durationB || 0);



  return (

    aStart < bEnd &&

    bStart < aEnd

  );



}





// =================================================

// 工具：疗愈师数据格式化

// =================================================



function formatTherapist(therapist) {



  const active =

    therapist.is_active !== false;



  const full =

    therapist.is_full === true;



  return {



    id:

      therapist.id,



    name:

      therapist.name,



    image:

      therapist.avatar || "",



    avatar:

      therapist.avatar || "",



    intro:

      therapist.bio || "",



    bio:

      therapist.bio || "",



    title:

      therapist.title || "专业疗愈师",



    experience:

      therapist.experience || "",



    specialty:

      therapist.specialties || "",



    specialties:

      therapist.specialties || "",



    gender:

      therapist.gender || "",



    return_rate:

      Number(

        therapist.return_rate || 0

      ),



    returnRate:

      Number(

        therapist.return_rate || 0

      ),



    satisfaction:

      Number(

        therapist.satisfaction || 0

      ),



    service_count:

      Number(

        therapist.service_count || 0

      ),



    serviceCount:

      Number(

        therapist.service_count || 0

      ),



    nationality:

      therapist.nationality || "",



    education:

      therapist.education || "",



    height:

      therapist.height || "",



    weight:

      therapist.weight || "",



    rating:

      Number(

        therapist.rating || 5

      ),



    review_count:

      Number(

        therapist.review_count || 0

      ),



    reviewCount:

      Number(

        therapist.review_count || 0

      ),



    active,



    isActive:

      active,



    is_active:

      active,



    is_full:

      full,



    isFull:

      full,



    available:

      active && !full,



    createdAt:

      therapist.created_at ||

      null



  };



}





// =================================================

// 获取全部疗愈师

// =================================================



async function getAllTherapists() {



  const result =

    await pool.query(`

      SELECT

        id,

        name,

        avatar,

        bio,

        experience,

        specialties,

        title,

        return_rate,

        satisfaction,

        service_count,

        nationality,

        education,

        height,

        weight,

        rating,

        review_count,

        gender,

        is_active,

        is_full,

        created_at

      FROM therapists

      ORDER BY id DESC

    `);



  return result.rows.map(

    formatTherapist

  );



}





// =================================================

// 健康检查

// =================================================



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





// =================================================

// 管理员登录

// =================================================



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

            "服务器管理员配置错误，请检查 Render 环境变量"

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





// =================================================

// 管理后台获取全部疗愈师

// =================================================



app.get(

  "/api/admin/therapists",

  requireAdmin,

  async (req, res) => {



    try {



      const therapists =

        await getAllTherapists();



      return res.json({

        success: true,

        therapists

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





// =================================================

// 前台获取疗愈师

// 不需要登录

// =================================================



app.get(

  "/api/therapists",

  async (req, res) => {



    try {



      const therapists =

        await getAllTherapists();



      return res.json({

        success: true,

        therapists

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





// =================================================

// 添加疗愈师

// =================================================



async function createTherapist(

  req,

  res

) {



  try {



    const {



      name,



      image,

      avatar,



      intro,

      bio,



      title,



      experience,



      specialty,

      specialties,



      gender,



      return_rate,

      returnRate,



      satisfaction,



      service_count,

      serviceCount,



      nationality,



      education,



      height,



      weight,



      rating,



      review_count,

      reviewCount,



      active,

      isActive,



      is_full,

      isFull



    } = req.body;





    if (

      !name ||

      !String(name).trim()

    ) {



      return res.status(400).json({

        success: false,

        message:

          "请输入疗愈师姓名"

      });



    }





    const finalAvatar =

      image ||

      avatar ||

      "";



    const finalBio =

      intro ||

      bio ||

      "";



    const finalSpecialties =

      specialty ||

      specialties ||

      "";



    const finalTitle =

      title ||

      "专业疗愈师";



    const finalGender =

      gender ||

      "";



    let finalActive =

      true;



    if (

      active === false ||

      active === "false" ||

      isActive === false ||

      isActive === "false"

    ) {



      finalActive = false;



    }





    let finalFull =

      false;



    if (

      is_full === true ||

      is_full === "true" ||

      isFull === true ||

      isFull === "true"

    ) {



      finalFull = true;



    }





    const result =

      await pool.query(

        `

        INSERT INTO therapists (

          name,

          avatar,

          bio,

          title,

          experience,

          specialties,

          gender,

          return_rate,

          satisfaction,

          service_count,

          nationality,

          education,

          height,

          weight,

          rating,

          review_count,

          is_active,

          is_full

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

          $12,

          $13,

          $14,

          $15,

          $16,

          $17,

          $18

        )



        RETURNING *

        `,



        [

          String(name).trim(),



          finalAvatar,



          finalBio,



          finalTitle,



          experience || "",



          finalSpecialties,



          finalGender,



          Number(

            return_rate ??

            returnRate ??

            0

          ),



          Number(

            satisfaction ||

            0

          ),



          Number(

            service_count ??

            serviceCount ??

            0

          ),



          nationality || "",



          education || "",



          height || "",



          weight || "",



          Number(

            rating ||

            5

          ),



          Number(

            review_count ??

            reviewCount ??

            0

          ),



          finalActive,



          finalFull

        ]

      );





    return res.json({

      success: true,

      message:

        "疗愈师添加成功",

      therapist:

        formatTherapist(

          result.rows[0]

        )

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





app.post(

  "/api/admin/therapists",

  requireAdmin,

  createTherapist

);





// =================================================

// 修改疗愈师

// =================================================



async function updateTherapist(

  req,

  res

) {



  try {



    const therapistId =

      Number(

        req.params.id

      );





    if (!therapistId) {



      return res.status(400).json({

        success: false,

        message:

          "疗愈师 ID 无效"

      });



    }





    const {



      name,



      image,

      avatar,



      intro,

      bio,



      title,



      experience,



      specialty,

      specialties,



      gender,



      return_rate,

      returnRate,



      satisfaction,



      service_count,

      serviceCount,



      nationality,



      education,



      height,



      weight,



      rating,



      review_count,

      reviewCount,



      active,

      isActive,



      is_full,

      isFull



    } = req.body;





    if (

      !name ||

      !String(name).trim()

    ) {



      return res.status(400).json({

        success: false,

        message:

          "请输入疗愈师姓名"

      });



    }





    let finalActive =

      true;



    if (

      active === false ||

      active === "false" ||

      isActive === false ||

      isActive === "false"

    ) {



      finalActive =

        false;



    }





    let finalFull =

      false;



    if (

      is_full === true ||

      is_full === "true" ||

      isFull === true ||

      isFull === "true"

    ) {



      finalFull =

        true;



    }





    const result =

      await pool.query(

        `

        UPDATE therapists



        SET



          name = $1,



          avatar = $2,



          bio = $3,



          title = $4,



          experience = $5,



          specialties = $6,



          gender = $7,



          return_rate = $8,



          satisfaction = $9,



          service_count = $10,



          nationality = $11,



          education = $12,



          height = $13,



          weight = $14,



          rating = $15,



          review_count = $16,



          is_active = $17,



          is_full = $18



        WHERE id = $19



        RETURNING *

        `,



        [



          String(name).trim(),



          image ||

          avatar ||

          "",



          intro ||

          bio ||

          "",



          title ||

          "专业疗愈师",



          experience ||

          "",



          specialty ||

          specialties ||

          "",



          gender ||

          "",



          Number(

            return_rate ??

            returnRate ??

            0

          ),



          Number(

            satisfaction ||

            0

          ),



          Number(

            service_count ??

            serviceCount ??

            0

          ),



          nationality ||

          "",



          education ||

          "",



          height ||

          "",



          weight ||

          "",



          Number(

            rating ||

            5

          ),



          Number(

            review_count ??

            reviewCount ??

            0

          ),



          finalActive,



          finalFull,



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

        formatTherapist(

          result.rows[0]

        )

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





app.put(

  "/api/admin/therapists/:id",

  requireAdmin,

  updateTherapist

);



app.patch(

  "/api/admin/therapists/:id",

  requireAdmin,

  updateTherapist

);





// =================================================

// 删除疗愈师

// =================================================



app.delete(

  "/api/admin/therapists/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const therapistId =

        Number(

          req.params.id

        );



      if (!therapistId) {



        return res.status(400).json({

          success: false,

          message:

            "疗愈师 ID 无效"

        });



      }



      const result =

        await pool.query(

          `

          DELETE FROM therapists

          WHERE id = $1

          RETURNING id

          `,

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

// 前台获取可预约疗愈师

// =================================================



app.get(

  "/api/available-therapists",

  async (req, res) => {



    try {



      const result =

        await pool.query(`

          SELECT

            id,

            name,

            avatar,

            bio,

            experience,

            specialties,

            title,

            return_rate,

            satisfaction,

            service_count,

            nationality,

            education,

            height,

            weight,

            rating,

            review_count,

            gender,

            is_active,

            is_full,

            created_at

          FROM therapists

          WHERE is_active = TRUE

          ORDER BY id DESC

        `);





      const therapists =

        result.rows.map(

          formatTherapist

        );





      return res.json({

        success: true,

        therapists

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





// =================================================

// 后台获取排班

// =================================================



app.get(

  "/api/admin/schedules",

  requireAdmin,

  async (req, res) => {



    try {



      const result =

        await pool.query(`

          SELECT

            s.id,

            s.therapist_id AS "therapistId",

            t.name AS "therapistName",

            s.work_date AS "date",

            s.start_time AS "startTime",

            s.end_time AS "endTime",

            s.created_at AS "createdAt"

          FROM therapist_schedules s

          LEFT JOIN therapists t

            ON t.id = s.therapist_id

          ORDER BY

            s.work_date DESC,

            s.id DESC

        `);





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





// =================================================

// 新增排班

// =================================================



app.post(

  "/api/admin/schedules",

  requireAdmin,

  async (req, res) => {



    try {



      const {



        therapistId,

        date,

        work_date,



        startTime,

        start_time,



        endTime,

        end_time



      } = req.body;





      const finalDate =

        date ||

        work_date;



      const finalStart =

        startTime ||

        start_time;



      const finalEnd =

        endTime ||

        end_time;





      if (

        !therapistId ||

        !finalDate ||

        !finalStart ||

        !finalEnd

      ) {



        return res.status(400).json({

          success: false,

          message:

            "疗愈师、日期、开始时间、结束时间不能为空"

        });



      }





      if (

        timeToMinutes(finalStart) >=

        timeToMinutes(finalEnd)

      ) {



        return res.status(400).json({

          success: false,

          message:

            "结束时间必须晚于开始时间"

        });



      }





      const result =

        await pool.query(

          `

          INSERT INTO therapist_schedules (

            therapist_id,

            work_date,

            start_time,

            end_time

          )



          VALUES (

            $1,

            $2,

            $3,

            $4

          )



          ON CONFLICT (

            therapist_id,

            work_date

          )



          DO UPDATE SET

            start_time = EXCLUDED.start_time,

            end_time = EXCLUDED.end_time



          RETURNING

            id,

            therapist_id AS "therapistId",

            work_date AS "date",

            start_time AS "startTime",

            end_time AS "endTime"

          `,



          [

            Number(therapistId),

            finalDate,

            finalStart,

            finalEnd

          ]

        );





      return res.json({

        success: true,

        message:

          "排班保存成功",

        schedule:

          result.rows[0]

      });



    } catch (error) {



      console.error(

        "保存排班失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "保存排班失败"

      });



    }



  }

);





// =================================================

// 修改排班

// =================================================



app.patch(

  "/api/admin/schedules/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const scheduleId =

        Number(

          req.params.id

        );





      const {



        therapistId,

        date,

        work_date,



        startTime,

        start_time,



        endTime,

        end_time



      } = req.body;





      const finalDate =

        date ||

        work_date;



      const finalStart =

        startTime ||

        start_time;



      const finalEnd =

        endTime ||

        end_time;





      if (

        !scheduleId ||

        !therapistId ||

        !finalDate ||

        !finalStart ||

        !finalEnd

      ) {



        return res.status(400).json({

          success: false,

          message:

            "排班信息不完整"

        });



      }





      if (

        timeToMinutes(finalStart) >=

        timeToMinutes(finalEnd)

      ) {



        return res.status(400).json({

          success: false,

          message:

            "结束时间必须晚于开始时间"

        });



      }





      const result =

        await pool.query(

          `

          UPDATE therapist_schedules



          SET

            therapist_id = $1,

            work_date = $2,

            start_time = $3,

            end_time = $4



          WHERE id = $5



          RETURNING

            id,

            therapist_id AS "therapistId",

            work_date AS "date",

            start_time AS "startTime",

            end_time AS "endTime"

          `,



          [

            Number(therapistId),

            finalDate,

            finalStart,

            finalEnd,

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

          "排班更新成功",

        schedule:

          result.rows[0]

      });



    } catch (error) {



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





// =================================================

// 删除排班

// =================================================



app.delete(

  "/api/admin/schedules/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const scheduleId =

        Number(

          req.params.id

        );





      const result =

        await pool.query(

          `

          DELETE FROM therapist_schedules



          WHERE id = $1



          RETURNING id

          `,

          [

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





// =================================================

// 获取可预约时间

// =================================================



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

        ) || 90;





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





      if (

        duration !== 90 &&

        duration !== 120

      ) {



        return res.status(400).json({

          success: false,

          message:

            "服务时长必须为90分钟或120分钟"

        });



      }





      // ===========================================

      // 检查疗愈师

      // ===========================================



      const therapistResult =

        await pool.query(

          `

          SELECT

            id,

            name,

            is_active,

            is_full

          FROM therapists

          WHERE id = $1

          `,

          [

            therapistId

          ]

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





      const therapist =

        therapistResult.rows[0];





      if (

        therapist.is_active === false

      ) {



        return res.json({

          success: true,

          date,

          therapistId,

          duration,

          slots: []

        });



      }





      if (

        therapist.is_full === true

      ) {



        return res.json({

          success: true,

          date,

          therapistId,

          duration,

          slots: []

        });



      }





      // ===========================================

      // 获取排班

      // ===========================================



      const scheduleResult =

        await pool.query(

          `

          SELECT

            start_time,

            end_time

          FROM therapist_schedules



          WHERE therapist_id = $1

          AND work_date = $2



          LIMIT 1

          `,

          [

            therapistId,

            date

          ]

        );





      let scheduleStart =

        "10:00";



      let scheduleEnd =

        "21:00";





      if (

        scheduleResult.rows.length > 0

      ) {



        scheduleStart =

          scheduleResult.rows[0].start_time;



        scheduleEnd =

          scheduleResult.rows[0].end_time;



      }





      // ===========================================

      // 获取已有订单

      // ===========================================



      const orderResult =

        await pool.query(

          `

          SELECT

            service_time,

            duration

          FROM orders



          WHERE therapist_id = $1

          AND service_date = $2

          AND status NOT IN ('已取消')

          `,

          [

            therapistId,

            date

          ]

        );





      const bookedOrders =

        orderResult.rows;





      // ===========================================

      // 每30分钟一个时间点

      // ===========================================



      const startMinutes =

        timeToMinutes(

          scheduleStart

        );



      const endMinutes =

        timeToMinutes(

          scheduleEnd

        );





      const slots = [];





      for (

        let minute = startMinutes;

        minute < endMinutes;

        minute += 30

      ) {



        const time =

          minutesToTime(

            minute

          );





        const serviceEnd =

          minute +

          duration;





        const insideSchedule =

          serviceEnd <= endMinutes;





        let booked =

          false;





        for (

          const order

          of bookedOrders

        ) {



          const orderDuration =

            Number(

              order.duration

            ) || 90;





          if (

            isTimeOverlap(

              time,

              duration,

              order.service_time,

              orderDuration

            )

          ) {



            booked = true;

            break;



          }



        }





        slots.push({



          time,



          available:

            insideSchedule &&

            !booked,



          disabled:

            !insideSchedule ||

            booked



        });



      }





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

// 创建预约订单

// =================================================



app.post(

  "/api/orders",

  async (req, res) => {



    const client =

      await pool.connect();



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



      const finalDuration =

        Number(duration) || 90;





      if (!service) {



        return res.status(400).json({

          success: false,

          message:

            "请选择疗愈服务"

        });



      }





      if (

        finalDuration !== 90 &&

        finalDuration !== 120

      ) {



        return res.status(400).json({

          success: false,

          message:

            "服务时长必须为90分钟或120分钟"

        });



      }





      if (!therapistId) {



        return res.status(400).json({

          success: false,

          message:

            "请选择疗愈师"

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

        !phoneRegex.test(

          String(phone)

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





      // ===========================================

      // 开始事务

      // ===========================================



      await client.query(

        "BEGIN"

      );





      // ===========================================

      // 防止同一疗愈师同时被两个订单抢占

      // ===========================================



      await client.query(

        `

        SELECT

          pg_advisory_xact_lock(

            $1

          )

        `,

        [

          Number(

            therapistId

          )

        ]

      );





      // ===========================================

      // 检查疗愈师

      // ===========================================



      const therapistCheck =

        await client.query(

          `

          SELECT

            id,

            name,

            is_active,

            is_full



          FROM therapists



          WHERE id = $1



          FOR UPDATE

          `,

          [

            Number(

              therapistId

            )

          ]

        );





      if (

        therapistCheck.rows.length === 0

      ) {



        await client.query(

          "ROLLBACK"

        );



        return res.status(400).json({

          success: false,

          message:

            "该疗愈师不存在"

        });



      }





      const therapistData =

        therapistCheck.rows[0];





      if (

        therapistData.is_active === false ||

        therapistData.is_full === true

      ) {



        await client.query(

          "ROLLBACK"

        );



        return res.status(400).json({

          success: false,

          message:

            "该疗愈师当前不可预约"

        });



      }





      // ===========================================

      // 检查排班

      // ===========================================



      const scheduleResult =

        await client.query(

          `

          SELECT

            start_time,

            end_time



          FROM therapist_schedules



          WHERE therapist_id = $1

          AND work_date = $2



          LIMIT 1

          `,

          [

            Number(

              therapistId

            ),

            finalDate

          ]

        );





      let scheduleStart =

        "10:00";



      let scheduleEnd =

        "21:00";





      if (

        scheduleResult.rows.length > 0

      ) {



        scheduleStart =

          scheduleResult.rows[0].start_time;



        scheduleEnd =

          scheduleResult.rows[0].end_time;



      }





      const requestStart =

        timeToMinutes(

          finalTime

        );



      const requestEnd =

        requestStart +

        finalDuration;





      if (

        requestStart <

        timeToMinutes(

          scheduleStart

        ) ||



        requestEnd >

        timeToMinutes(

          scheduleEnd

        )

      ) {



        await client.query(

          "ROLLBACK"

        );



        return res.status(400).json({

          success: false,

          message:

            "该时间不在疗愈师工作时间内"

        });



      }





      // ===========================================

      // 检查已有订单时间冲突

      // ===========================================



      const conflictResult =

        await client.query(

          `

          SELECT

            id,

            service_time,

            duration



          FROM orders



          WHERE therapist_id = $1



          AND service_date = $2



          AND status NOT IN ('已取消')



          FOR UPDATE

          `,

          [

            Number(

              therapistId

            ),

            finalDate

          ]

        );





      let hasConflict =

        false;





      for (

        const order

        of conflictResult.rows

      ) {



        const orderDuration =

          Number(

            order.duration

          ) || 90;





        if (

          isTimeOverlap(

            finalTime,

            finalDuration,

            order.service_time,

            orderDuration

          )

        ) {



          hasConflict = true;

          break;



        }



      }





      if (hasConflict) {



        await client.query(

          "ROLLBACK"

        );



        return res.status(409).json({

          success: false,

          message:

            "该时间段已被其他客户预约，请重新选择"

        });



      }





      // ===========================================

      // 创建订单

      // ===========================================



      const orderId =

        "YX" +

        Date.now() +

        Math.floor(

          Math.random() * 10000

        );





      const insertResult =

        await client.query(

          `

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

            $12



          )



          RETURNING



            id,



            service,



            price,



            duration,



            therapist,



            therapist_id AS "therapistId",



            service_date AS "date",



            service_time AS "time",



            customer_name AS "name",



            phone,



            address,



            status,



            created_at AS "createdAt"

          `,



          [



            orderId,



            service,



            Number(price) || 0,



            String(

              finalDuration

            ),



            therapistData.name,



            Number(

              therapistId

            ),



            finalDate,



            finalTime,



            finalName,



            phone,



            address,



            "待确认"



          ]

        );





      await client.query(

        "COMMIT"

      );





      return res.json({



        success: true,



        message:

          "预约提交成功",



        order:

          insertResult.rows[0]



      });



    } catch (error) {



      try {



        await client.query(

          "ROLLBACK"

        );



      } catch {}



      console.error(

        "创建订单失败：",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "服务器处理失败"

      });



    } finally {



      client.release();



    }



  }

);





// =================================================

// 后台获取订单

// =================================================



app.get(

  "/api/orders",

  requireAdmin,

  async (req, res) => {



    try {



      const result =

        await pool.query(`

          SELECT



            id,



            service,



            price,



            duration,



            therapist,



            therapist_id AS "therapistId",



            service_date AS "date",



            service_time AS "time",



            customer_name AS "name",



            phone,



            address,



            status,



            created_at AS "createdAt"



          FROM orders



          ORDER BY

            created_at DESC

        `);





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





// =================================================

// 修改订单状态

// =================================================



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





      const result =

        await pool.query(

          `

          UPDATE orders



          SET

            status = $1



          WHERE

            id = $2



          RETURNING

            id,

            status

          `,



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





// =================================================

// 删除订单

// =================================================



app.delete(

  "/api/orders/:id",

  requireAdmin,

  async (req, res) => {



    try {



      const orderId =

        req.params.id;





      const result =

        await pool.query(

          `

          DELETE FROM orders



          WHERE id = $1



          RETURNING id

          `,



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





// =================================================

// 首页

// =================================================



app.get(

  "/",

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





// =================================================

// 启动服务器

// =================================================



async function startServer() {



  await initDatabase();



  app.listen(

    PORT,

    () => {



      console.log(

        "================================"

      );



      console.log(

        "奕心疗愈舍服务器启动成功"

      );



      console.log(

        "端口：",

        PORT

      );



      console.log(

        "================================"

      );



    }

  );



}





startServer();
