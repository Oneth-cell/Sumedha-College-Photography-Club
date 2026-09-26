import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config({ path: ".env.local" });

console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log(
  "SMTP_PASS:",
  process.env.SMTP_PASS ? "FOUND" : "MISSING"
);
console.log("SMTP_FROM:", process.env.SMTP_FROM);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

try {
  await transporter.verify();
  console.log("✅ SMTP connection successful!");

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL,
    subject: "Sumedha Photography Club - Test Email",
    text: "This is a test email from your local Next.js project.",
  });

  console.log("✅ TEST EMAIL SENT!");
} catch (error) {
  console.error("❌ EMAIL TEST FAILED");
  console.error(error);
}