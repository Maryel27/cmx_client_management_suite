const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const bcrypt = require("bcrypt");
const db = require("./config/dbconfig");
const multer = require("multer");
const fs = require("fs");
const upload = multer({ storage: multer.memoryStorage() });
const s3 = new AWS.S3();
const ESCALATION_BUCKET = "cmxclientescalationfiles"; // change if needed

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Nodemailer (SES)
const transporter = nodemailer.createTransport({
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const app = express();
const PORT = process.env.SERVER_PORT || 5005;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// ---------- EMAIL CHECK ----------
app.post("/api/check-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT user_email, user_last_name, user_first_name, user_full_name, user_access_level, user_status 
       FROM 0000_cmx_appdata_appusers.db_cmx_appusers_clientmanagement 
       WHERE user_email = ?`,
      [email],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Email not registered",
      });
    }

    const user = rows[0];

    if (user.user_status !== "Active") {
      return res.status(403).json({
        success: false,
        error: "Inactive user",
      });
    }

    // ✅ Unified response
    return res.json({
      success: true,
      user: {
        userid: user.user_email,
        userEmail: user.user_email,
        lastName: user.user_last_name,
        firstName: user.user_first_name,
        fullName: user.user_full_name,
        userLevel: user.user_access_level,
        userStatus: user.user_status,
      },
    });
  } catch (err) {
    console.error("Email check DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// ---------- OTP SENDING ----------
app.post("/api/sendOTP", async (req, res) => {
  try {
    const { emailAddress, requestedDateTime, expiryDateTime } = req.body;

    if (!emailAddress || !requestedDateTime || !expiryDateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // ✅ Generate and hash OTP
    const otpPlain = String(
      Math.floor(100000 + Math.random() * 900000),
    ).padStart(6, "0");

    const salt = await bcrypt.genSalt(10);
    const otpHashed = await bcrypt.hash(otpPlain, salt);

    // ✅ Send OTP via email
    await transporter.sendMail({
      from: "noreply@callmaxsolutions.com",
      to: emailAddress,
      subject: "One-Time Password (OTP) - CMX Client Management Suite",
      html: `
        <p>Hi,</p>
        <p>Your One-Time Password (OTP) is:</p>
        <h2>${otpPlain}</h2>
        <p>This OTP will expire in <strong>3 minutes</strong>.</p>
        <p>Please do not share your OTP.</p>
        <p>If you did not request this code and suspect invalid use, report instance to dream-devops@callmaxsolutions.com</p>
        <hr>
        <p><strong>Confidentiality & Data Privacy</strong></p>
        <p>This email and its attachments are confidential, intended only for the specified recipient(s), and may contain legally privileged information. Unauthorized review, use, disclosure, or distribution is prohibited. If you received this email by mistake, please notify the sender and delete it and its attachments from your system.</p>
        <p>Opinions expressed are the sender's own and may not reflect those of Callmax Solutions International Inc. While precautions are taken to ensure virus-free emails, we accept no liability for any resulting damage.</p>
        <p>Data Privacy: We respect your data privacy and handle personal data in compliance with applicable laws. Personal data received via email is processed for intended purposes and protected as per our privacy policies. Unauthorized use or disclosure of this email or its contents is prohibited and may be illegal.</p>
      `,
    });

    // ✅ Return hashed OTP only
    res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
      otpHashed,
    });
  } catch (error) {
    console.error("Error in /sendOTP:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while sending the OTP.",
      error: error.message,
    });
  }
});

// ---------- CLIENT ROSTER (Landing Page) ----------
app.get("/api/client-roster", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT
        ID,
        EFFECTIVEDATE,
        ACCOUNTCODE,
        QBACCOUNT,
        ACCOUNT,
        LOB,
        TASK,
        MSA_DATE,
        LIVE_DATE,
        STAFFINGMODEL,
        SITE,
        WORKSETUP,
        DRFTE,
        PHFTE,
        DAILYWORKHRS,
        HOLIDAYHRS,
        REGULARRATE,
        PREMIUMRATE,
        DEPOSITFEE,
        DEPOSITFEEWAIVED,
        SETUPFEE,
        SETUPFEEWAIVED,
        EXTRAMONITORFEEPERUNIT,
        EXTRAMONITORQTY,
        PHONELINEFEEPERFTEPERMONTH,
        BILLINGCYCLE,
        STATUS,
        BUSADDRESS,
        STATE,
        CONTACT1,
        CONTACTNO1,
        CONTACT2,
        CONTACTNO2,
        SALESPERSON,
        NOTES,
        INSTRUCTIONS,
        TERMDATE
      FROM (
        SELECT
          ID,
          EFFECTIVEDATE,
          ACCOUNTCODE,
          QBACCOUNT,
          ACCOUNT,
          LOB,
          TASK,
          MSA_DATE,
          LIVE_DATE,
          STAFFINGMODEL,
          SITE,
          WORKSETUP,
          DRFTE,
          PHFTE,
          DAILYWORKHRS,
          HOLIDAYHRS,
          REGULARRATE,
          PREMIUMRATE,
          DEPOSITFEE,
          DEPOSITFEEWAIVED,
          SETUPFEE,
          SETUPFEEWAIVED,
          EXTRAMONITORFEEPERUNIT,
          EXTRAMONITORQTY,
          PHONELINEFEEPERFTEPERMONTH,
          BILLINGCYCLE,
          STATUS,
          BUSADDRESS,
          STATE,
          CONTACT1,
          CONTACTNO1,
          CONTACT2,
          CONTACTNO2,
          SALESPERSON,
          NOTES,
          INSTRUCTIONS,
          TERMDATE,
          ROW_NUMBER() OVER (
            PARTITION BY ACCOUNTCODE
            ORDER BY
              CASE WHEN EFFECTIVEDATE IS NULL THEN 1 ELSE 0 END,
              EFFECTIVEDATE DESC,
              ID DESC
          ) AS rn
        FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
      ) AS t
      WHERE rn = 1
      ORDER BY ACCOUNT ASC
      `,
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Client roster DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load client roster.",
    });
  }
});

//Insert New Client Profile
// ---------- HELPERS ----------
const normalizeDate = (val) => {
  if (!val) return null;
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed === "" ? null : trimmed;
};

const normalizeNumber = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
};

const formatNoteEntry = (first, last, rawNote) => {
  const now = new Date();

  // format timestamp (MM-DD-YYYY HH:mm AM/PM)
  const options = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  };

  const timestamp = now.toLocaleString("en-US", options).replace(",", "");

  return `---- ${first} ${last} || ${timestamp} ----

${rawNote || ""}`;
};

const mysql = require("mysql2/promise"); // Needed to connect to Harmony

app.post("/api/client-roster", async (req, res) => {
  try {
    const {
      effectiveDate,
      accountCode,
      qbAccount,
      account,
      lob,
      task,
      msaDate,
      liveDate,
      site,
      workSetup, // ✅ NEW
      staffingModel,
      drfte,
      phfte,
      dailyWorkHrs,
      holidayHrs,
      regularRate,
      premiumRate,
      depositFee,
      depositFeeWaived,
      setupFee,
      setupFeeWaived,
      extraMonitorFeePerUnit,
      extraMonitorQty,
      phoneLineFeePerFTEPerMonth,
      billingCycle,
      status,
      busAddress,
      state,
      contact1,
      contactNo1,
      contact2,
      contactNo2,
      salesperson,
      notes,
      instructions,
      termDate,
      userFirstName,
      userLastName,
    } = req.body;

    // Normalize fields
    const safeEffective = normalizeDate(effectiveDate);
    const safeMSA = normalizeDate(msaDate);
    const safeLive = normalizeDate(liveDate);
    const safeTerm = normalizeDate(termDate);
    const safeDRFTE = normalizeNumber(drfte);
    const safePHFTE = normalizeNumber(phfte);
    const safeDailyHrs = normalizeNumber(dailyWorkHrs);
    const safeHolidayHrs = normalizeNumber(holidayHrs);
    const safeRegular = normalizeNumber(regularRate);
    const safePremium = normalizeNumber(premiumRate);
    const safeDeposit = normalizeNumber(depositFee);
    const safeSetup = normalizeNumber(setupFee);
    const safeMonitorFee = normalizeNumber(extraMonitorFeePerUnit);
    const safeMonitorQty = normalizeNumber(extraMonitorQty);
    const safePhoneLine = normalizeNumber(phoneLineFeePerFTEPerMonth);
    const formattedNotes = formatNoteEntry(userFirstName, userLastName, notes);

    const values = [
      safeEffective,
      accountCode,
      qbAccount,
      account,
      lob,
      task,
      safeMSA,
      safeLive,
      site,
      workSetup,
      staffingModel,
      safeDRFTE,
      safePHFTE,
      safeDailyHrs,
      safeHolidayHrs,
      safeRegular,
      safePremium,
      safeDeposit,
      depositFeeWaived,
      safeSetup,
      setupFeeWaived,
      safeMonitorFee,
      safeMonitorQty,
      safePhoneLine,
      billingCycle,
      status,
      busAddress,
      state,
      contact1,
      contactNo1,
      contact2,
      contactNo2,
      salesperson,
      formattedNotes,
      instructions || null,
      safeTerm,
    ];

    // ✅ Insert into Primary (existing) DB — no changes
    const [result] = await db.execute(
      `INSERT INTO 1000_cmx_appdata_client_database.db_cmx_client_roster (
        EFFECTIVEDATE,
        ACCOUNTCODE,
        QBACCOUNT,
        ACCOUNT,
        LOB,
        TASK,
        MSA_DATE,
        LIVE_DATE,
        SITE,
        WORKSETUP, -- ✅ NEW
        STAFFINGMODEL,
        DRFTE,
        PHFTE,
        DAILYWORKHRS,
        HOLIDAYHRS,
        REGULARRATE,
        PREMIUMRATE,
        DEPOSITFEE,
        DEPOSITFEEWAIVED,
        SETUPFEE,
        SETUPFEEWAIVED,
        EXTRAMONITORFEEPERUNIT,
        EXTRAMONITORQTY,
        PHONELINEFEEPERFTEPERMONTH,
        BILLINGCYCLE,
        STATUS,
        BUSADDRESS,
        STATE,
        CONTACT1,
        CONTACTNO1,
        CONTACT2,
        CONTACTNO2,
        SALESPERSON,
        NOTES,
        INSTRUCTIONS,
        TERMDATE
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      values,
    );

    const insertedId = result.insertId;

    // ✅ Insert into Harmony DB (locally created connection)
    try {
      const harmonyDb = await mysql.createConnection({
        host: process.env.HARMONY_MYSQL_HOST,
        user: process.env.HARMONY_MYSQL_USER,
        password: process.env.HARMONY_MYSQL_PASSWORD,
        database: "cmx_harmony_clientroster", // hardcoded schema
      });

      await harmonyDb.execute(
        `INSERT INTO cmx_harmony_clientroster.db_cmx_harmony_clientroster (
        EFFECTIVEDATE,
        ACCOUNTCODE,
        QBACCOUNT,
        ACCOUNT,
        LOB,
        TASK,
        MSA_DATE,
        LIVE_DATE,
        SITE,
        WORKSETUP, 
        STAFFINGMODEL,
        DRFTE,
        PHFTE,
        DAILYWORKHRS,
        HOLIDAYHRS,
        REGULARRATE,
        PREMIUMRATE,
        DEPOSITFEE,
        DEPOSITFEEWAIVED,
        SETUPFEE,
        SETUPFEEWAIVED,
        EXTRAMONITORFEEPERUNIT,
        EXTRAMONITORQTY,
        PHONELINEFEEPERFTEPERMONTH,
        BILLINGCYCLE,
        STATUS,
        BUSADDRESS,
        STATE,
        CONTACT1,
        CONTACTNO1,
        CONTACT2,
        CONTACTNO2,
        SALESPERSON,
        NOTES,
        INSTRUCTIONS,
        TERMDATE
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        values,
      );

      await harmonyDb.end();
      console.log("✅ Inserted into Harmony DB");
    } catch (harmonyErr) {
      console.warn("⚠️ Harmony DB insert failed:", harmonyErr.message);
    }

    // ✅ Fetch inserted row from primary DB
    const [rows] = await db.execute(
      `SELECT * FROM 1000_cmx_appdata_client_database.db_cmx_client_roster WHERE ID = ?`,
      [insertedId],
    );

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error("❌ Error inserting client:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to save client.",
    });
  }
});

// ---------- APPEND NOTE TO CLIENT (NOTES FIELD) ----------
app.put("/api/client-roster/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { note, userFirstName, userLastName } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        error: "Note text is required.",
      });
    }

    // 🧑‍💼 Build user name
    const fullName =
      `${userFirstName || ""} ${userLastName || ""}`.trim() || "Unknown User";

    // 🕒 Build timestamp in EST, format: MM-DD-YYYY hh:mm AM/PM EST
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const month = get("month");
    const day = get("day");
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    const ampm = get("dayPeriod");

    const formattedStamp = `${month}-${day}-${year} ${hour}:${minute} ${ampm} EST`;

    const headerLine = `---- ${fullName} || ${formattedStamp} ----`;
    const newBlock = `${headerLine}\n\n${note.trim()}`;

    // 🔍 Get existing notes
    const [rows] = await db.execute(
      `SELECT NOTES 
       FROM 1000_cmx_appdata_client_database.db_cmx_client_roster 
       WHERE ID = ?`,
      [id],
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Client not found.",
      });
    }

    const existingNotes = rows[0].NOTES || "";

    // 📌 Append new block at the bottom (chronological)
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n${newBlock}`
      : newBlock;

    // 💾 Update record
    await db.execute(
      `UPDATE 1000_cmx_appdata_client_database.db_cmx_client_roster
       SET NOTES = ?
       WHERE ID = ?`,
      [updatedNotes, id],
    );

    return res.json({
      success: true,
      notes: updatedNotes,
    });
  } catch (err) {
    console.error("Error updating client notes:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to update notes.",
    });
  }
});

// ---------- ESCALATIONS ----------
app.get("/api/escalMaxId", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT MAX(ID) as escalmaxID FROM 1000_cmx_appdata_client_database.db_cmx_client_escalations",
    );
    const maxId = results[0]?.escalmaxID || 0;
    res.json({ maxId });
  } catch (error) {
    console.error("Error fetching max ID:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/accountDetails", async (req, res) => {
  const query = `
    SELECT *
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster r
    WHERE r.ID IN (
      SELECT MAX(ID)
      FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
      WHERE STATUS = 'Active'
      GROUP BY 
        ACCOUNTCODE,
        UPPER(TRIM(REGEXP_REPLACE(ACCOUNT,'[[:space:]]+',' ')))
    )
    AND r.STATUS = 'Active'
    ORDER BY r.ID DESC
  `;

  try {
    const [result] = await db.query(query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching account details:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/oicList", async (req, res) => {
  const query = `
    SELECT * FROM 1000_cmx_appdata_client_database.db_cmx_oiclist;
  `;

  try {
    const [result] = await db.query(query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching OIC list:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// 📥 Fetch escalations (with optional filtering by OIC_EMAIL if role = user)
app.get("/api/escalations", async (req, res) => {
  try {
    const { userid, role } = req.headers;
    let query = `SELECT * FROM 1000_cmx_appdata_client_database.db_cmx_client_escalations`;
    if (role === "User") query += ` WHERE OIC_EMAIL = '${userid}'`;

    const [rows] = await db.query(query);

    const escalationsWithUrls = await Promise.all(
      rows.map(async (row) => {
        if (row.ATTACHMENT) {
          try {
            row.attachmentUrl = await s3.getSignedUrlPromise("getObject", {
              Bucket: ESCALATION_BUCKET,
              Key: row.ATTACHMENT,
              Expires: 3600,
            });
          } catch (err) {
            console.error("Signed URL error:", err);
            row.attachmentUrl = null;
          }
        } else {
          row.attachmentUrl = null;
        }
        return row;
      }),
    );

    res.json({
      success: true,
      data: escalationsWithUrls,
    });
  } catch (err) {
    console.error("Error fetching escalations:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 📤 Add new escalation (w/ optional file upload)
app.post("/api/add-escalation", upload.single("file"), async (req, res) => {
  try {
    const data = req.body;
    let attachmentKey = null;

    if (req.file) {
      attachmentKey = `uploads/${Date.now()}-${req.file.originalname}`;
      await s3
        .upload({
          Bucket: ESCALATION_BUCKET,
          Key: attachmentKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: "private",
        })
        .promise();
    }

    const query = `
      INSERT INTO 1000_cmx_appdata_client_database.db_cmx_client_escalations (
        ESCALATION_DATE, ESCALATIONID, CLIENTCATEGORY, ACCOUNT, LOB, TASK, SITE,
        OIC, OIC_EMAIL, ESCALATIONTYPE, ESCALATIONDETAILS, VALIDITY, CRITICALITY,
        REPORTSUBMITTED, REPORTSUBMITTEDDATE, STATUS, RESOLVEDDATE, ACCOUNTCODE,
        ACTIONTAKEN, RESOLUTIONSTATUS, DATELASTUPDATED, ATTACHMENT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      normalizeDate(data.escalationDate),
      data.escalationID,
      data.clientCategory,
      data.account,
      data.lob,
      data.task,
      data.site,
      data.oic,
      data.oicEmail,
      data.escalationType,
      data.escalationDetails,
      data.validity,
      data.criticality,
      data.reportSubmitted,
      normalizeDate(data.reportSubmittedDate),
      data.status,
      normalizeDate(data.resolvedDate),
      data.accountCode,
      data.actionTaken,
      data.resolutionStatus,
      normalizeDate(data.dateLastUpdated),
      attachmentKey,
    ];

    await db.query(query, values);

    // 📧 Notify via email
    await transporter.sendMail({
      from: "noreply@callmaxsolutions.com",
      to: `${data.oicEmail}; clientservicesteam@callmaxsolutions.com`,
      cc:
        data.criticality === "High" ? process.env.EMAIL_RECEPIENTS : undefined,
      subject: `Client Escalation || ${data.account} (${data.escalationID})`,
      html: `
        <p>Hi ${data.oic},</p>
        <p>A client escalation was logged:</p>
        <ul>
          <li><strong>Date:</strong> ${data.escalationDate}</li>
          <li><strong>ID:</strong> ${data.escalationID}</li>
          <li><strong>Account:</strong> ${data.account}</li>
          <li><strong>LOB:</strong> ${data.lob}</li>
          <li><strong>Criticality:</strong> ${data.criticality}</li>
        </ul>
        <p>View and manage via <a href="https://cms.cmxph.com/ClientEscalations">Client Escalations</a></p>
        <p>This is an automated email. Do not reply.</p>
      `,
    });

    res.status(200).json({ success: true, escalationID: data.escalationID });
  } catch (err) {
    console.error("Error adding escalation:", err);
    res.status(500).json({ error: "Database or email error" });
  }
});

app.post(
  "/api/updateEscalationInfo",
  upload.single("file"),
  async (req, res) => {
    try {
      const data = req.body;
      let attachmentKey = data.attachment || null;

      if (req.file) {
        attachmentKey = `uploads/${Date.now()}-${req.file.originalname}`;

        await s3
          .upload({
            Bucket: ESCALATION_BUCKET,
            Key: attachmentKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: "private",
          })
          .promise();
      }

      const query = `
      UPDATE 1000_cmx_appdata_client_database.db_cmx_client_escalations
      SET ESCALATION_DATE = ?, ESCALATIONID = ?, CLIENTCATEGORY = ?, ACCOUNT = ?, LOB = ?, TASK = ?, SITE = ?, 
          OIC = ?, OIC_EMAIL = ?, ESCALATIONTYPE = ?, ESCALATIONDETAILS = ?, VALIDITY = ?, CRITICALITY = ?, 
          REPORTSUBMITTED = ?, REPORTSUBMITTEDDATE = ?, STATUS = ?, RESOLVEDDATE = ?, ACCOUNTCODE = ?, 
          ACTIONTAKEN = ?, RESOLUTIONSTATUS = ?, DATELASTUPDATED = ?, ATTACHMENT = ?
      WHERE ESCALATIONID = ?;
    `;

      const values = [
        normalizeDate(data.escalationDate),
        data.escalationID,
        data.clientCategory,
        data.account,
        data.lob,
        data.task,
        data.site,
        data.oic,
        data.oicEmail,
        data.escalationType,
        data.escalationDetails,
        data.validity,
        data.criticality,
        data.reportSubmitted,
        normalizeDate(data.reportSubmittedDate),
        data.status,
        normalizeDate(data.resolvedDate),
        data.accountCode,
        data.actionTaken,
        data.resolutionStatus,
        normalizeDate(data.dateLastUpdated),
        attachmentKey,
        data.escalationID,
      ];

      await db.query(query, values);

      // Send updated escalation email
      await transporter.sendMail({
        from: "noreply@callmaxsolutions.com",
        to: `${data.oicEmail}; clientservicesteam@callmaxsolutions.com`,
        cc:
          data.criticality === "High"
            ? process.env.EMAIL_RECEPIENTS
            : undefined,
        subject: `Updated Escalation || ${data.account} (${data.escalationID})`,
        html: `
        <p>The escalation <strong>${data.escalationID}</strong> has been updated.</p>
        <ul>
          <li><strong>Account:</strong> ${data.account}</li>
          <li><strong>Criticality:</strong> ${data.criticality}</li>
          <li><strong>Status:</strong> ${data.status}</li>
        </ul>
        <p><strong>Details:</strong> ${data.escalationDetails}</p>
      `,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Update escalation error:", error);
      res.status(500).json({ error: "Database or upload error" });
    }
  },
);

app.get("/api/voc-responses", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        id,
        name,
        company,
        email,
        tasks,
        satisfaction,
        recommend,
        communication,
        collaboration,
        consistency,
        attachment_files
      FROM 1006_customer_survey_system.survey_responses
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("VOC responses error:", err);

    res.status(500).json({
      success: false,
      error: "Failed to fetch VOC responses",
    });
  }
});

app.get("/api/voc-attachment", async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: "Missing file key",
      });
    }

    const params = {
      Bucket: ESCALATION_BUCKET,
      Key: key, // ✅ use the exact key stored in DB
      Expires: 60,
    };

    const signedUrl = s3.getSignedUrl("getObject", params);

    res.json({
      success: true,
      url: signedUrl,
    });
  } catch (err) {
    console.error("S3 signed URL error:", err);

    res.status(500).json({
      success: false,
      error: "Failed to generate file URL",
    });
  }
});

app.get("/clients", async (req, res) => {
  try {
    const sql = `
    SELECT DISTINCT ACCOUNT
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
    WHERE STATUS = 'Active'
    ORDER BY ACCOUNT ASC
    `;

    const [rows] = await db.execute(sql);

    res.json(rows);
    // console.log(rows);
  } catch (error) {
    console.error("❌ Error fetching clients:", error);
    res.status(500).json({ message: "Error fetching clients" });
  }
});

app.post("/api/send-survey-email", async (req, res) => {
  const { month, client, emailType, email, recipientName, agentName, notes } =
    req.body;

  try {
    console.log("Frontend URL:", process.env.SURVEY_FRONTEND_URL);

    const surveyLink = `${process.env.SURVEY_FRONTEND_URL}/company-survey?email=${email}&client=${client}&month=${month}`;

    console.log("📧 Sending survey email to:", email);
    console.log("🔗 Survey link generated:", surveyLink);

    const greeting =
      emailType === "individual" ? `Greetings, ${recipientName}` : `Greetings!`;

    const mailOptions = {
      from: '"Callmax Client Services" <noreply@callmaxsolutions.com>',
      to: email,
      subject: `Callmax ${month} Performance Survey`,
      html: `
      <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:30px;">
        <div style="max-width:600px;margin:auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="background:#003b5c;color:white;padding:20px;text-align:center;">
            <h2 style="margin:0;">Callmax Customer Experience Survey</h2>
          </div> 

          <div style="padding:30px;color:#333;line-height:1.6;">
            <p><b>${greeting}</b></p>

            <p>We hope this message finds you well.</p>

            <p>
              As part of our ongoing commitment to delivering excellent service to 
              <b>${client}</b>, we would truly appreciate your feedback on the support provided by 
              <b>${agentName}</b> during the month of <b>${month}</b>.

              ${
                notes
                  ? `
                  <br/><br/>
                  <b>Additional Notes:</b><br/>
                  ${notes}
                `
                  : ""
              }
              <br>
              <br>
              Your feedback will help us better understand how we are performing and identify opportunities to further improve the quality of our services.
            </p>

            <div style="text-align:center;margin:35px 0;">
              <a href="${surveyLink}"
                style="
                  background:#003b5c;
                  color:white;
                  padding:14px 28px;
                  text-decoration:none;
                  border-radius:6px;
                  font-weight:bold;
                  display:inline-block;
                  font-size:16px;
                ">
                Take the Survey
              </a>
            </div>

            <p>The survey should only take a few minutes to complete.</p>

            <p>
              Thank you for taking the time to share your feedback and for your continued partnership with Callmax.
            </p>
          </div>

          <div style="background:#f1f5f9;padding:15px;text-align:center;font-size:12px;color:#666;">
            © ${new Date().getFullYear()} Callmax Solutions<br>
            Client Services Team
          </div>
        </div>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    try {
      const sql = `
        INSERT INTO 1006_customer_survey_system.email_requests
        (month, client, email_type, email, recipient_name, agent_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await db.execute(sql, [
        month,
        client,
        emailType,
        email,
        recipientName || null,
        agentName,
        notes,
      ]);

      console.log("💾 Email request saved to database");
    } catch (dbError) {
      console.error("❌ Database save failed:", dbError);

      return res.status(200).json({
        success: true,
        partialSuccess: true,
        message:
          "Email sent successfully, but failed to save the request to the database.",
      });
    }

    console.log("✅ Email sent successfully");

    return res.status(200).json({
      success: true,
      message: "Survey email sent successfully!",
    });
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending email",
    });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
