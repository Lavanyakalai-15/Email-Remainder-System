// server.js
import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// 1. Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error", err));

// 2. Define schema
const reminderSchema = new mongoose.Schema({
  recipient: String,
  subject: String,
  message: String,
  when: Date,
  repeat: String,
  priority: String,
  sentCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
});

const Reminder = mongoose.model("Reminder", reminderSchema);

// 3. Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 4. API Routes

// GET all reminders
app.get("/api/reminders", async (req, res) => {
  const reminders = await Reminder.find();
  res.json(reminders);
});

// POST new reminder
app.post("/api/reminders", async (req, res) => {
  const reminder = new Reminder(req.body);
  await reminder.save();
  res.json({ message: "Reminder saved", reminder });
});

// DELETE reminder
app.delete("/api/reminders/:id", async (req, res) => {
  await Reminder.findByIdAndDelete(req.params.id);
  res.json({ message: "Reminder deleted" });
});

// SEND test email
app.post("/api/send-test", async (req, res) => {
  const { recipient, subject, message } = req.body;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipient,
      subject: subject,
      text: message + "\n\n[Test Email]"
    });
    res.json({ success: true, message: "Test email sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to send" });
  }
});

// 5. Cron-like scheduler
setInterval(async () => {
  const now = new Date();
  const dueReminders = await Reminder.find({ active: true, when: { $lte: now } });

  for (const r of dueReminders) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: r.recipient,
        subject: r.subject,
        text: r.message
      });

      console.log(`📧 Sent reminder to ${r.recipient}`);
      r.sentCount += 1;

      if (r.repeat === "daily") r.when.setDate(r.when.getDate() + 1);
      else if (r.repeat === "weekly") r.when.setDate(r.when.getDate() + 7);
      else if (r.repeat === "monthly") r.when.setMonth(r.when.getMonth() + 1);
      else r.active = false;

      await r.save();
    } catch (err) {
      console.error("Email send error:", err);
    }
  }
}, 15000); // check every 15 seconds

// 6. Start server
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
});
