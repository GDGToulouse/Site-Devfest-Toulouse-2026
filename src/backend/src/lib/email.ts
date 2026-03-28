import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
});

const FROM = process.env.SMTP_FROM || "contact@devfesttoulouse.fr";

interface SendEmailOptions {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  await transporter.sendMail({
    from: FROM,
    to: to.join(", "),
    subject,
    text,
    html,
  });
}
