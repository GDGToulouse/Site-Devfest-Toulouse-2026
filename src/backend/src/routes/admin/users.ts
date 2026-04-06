import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../../lib/email.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface CreateUserBody {
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR";
}

interface UpdateUserBody {
  role?: "ADMIN" | "EDITOR";
  name?: string;
}

export default async function adminUserRoutes(app: FastifyInstance) {
  // GET /api/admin/users — list all admin users
  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        banned: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          orderBy: { expiresAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return users.map((u: (typeof users)[number]) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      banned: u.banned,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      lastLogin: u.sessions[0]?.createdAt || null,
    }));
  });

  // POST /api/admin/users — invite a new user
  app.post<{ Body: CreateUserBody }>("/users", async (request, reply) => {
    const { email, name, role } = request.body;

    if (!email || !name) {
      return reply.code(400).send({ error: "Email and name are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "A user with this email already exists" });
    }

    // Create user without password — they will set it via password reset
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || "EDITOR",
        emailVerified: true,
      },
    });

    // Send invitation email with password reset link
    try {
      const resetUrl = `${BASE_URL}/fr/admin`;
      await sendEmail({
        to: [email],
        subject: "Invitation DevFest Toulouse — Acces admin",
        text: `Bonjour ${name},\n\nVous avez ete invite a acceder au back-office du DevFest Toulouse.\n\nVotre role : ${role}\n\nConnectez-vous sur : ${resetUrl}\nUtilisez "Mot de passe oublie" pour definir votre mot de passe.\n\nA bientot !`,
        html: `
        <h3>Invitation DevFest Toulouse</h3>
        <p>Bonjour ${name},</p>
        <p>Vous avez ete invite a acceder au back-office du DevFest Toulouse.</p>
        <p><strong>Role :</strong> ${role === "ADMIN" ? "Administrateur" : "Editeur"}</p>
        <p>Connectez-vous sur : <a href="${resetUrl}">${resetUrl}</a></p>
        <p>Utilisez <strong>"Mot de passe oublie"</strong> pour definir votre mot de passe.</p>
        `,
      });
    } catch {
      // Email failed but user is created — not a blocker
    }

    return reply.code(201).send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });

  // PUT /api/admin/users/:id — update user role or name
  app.put<{
    Params: { id: string };
    Body: UpdateUserBody;
  }>("/users/:id", async (request, reply) => {
    const { id } = request.params;
    const { role, name } = request.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found" });

    const data: Record<string, string> = {};
    if (role) data.role = role;
    if (name !== undefined) data.name = name;

    const user = await prisma.user.update({ where: { id }, data });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  // PUT /api/admin/users/:id/ban — toggle ban status
  app.put<{ Params: { id: string } }>(
    "/users/:id/ban",
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = (request as unknown as { adminUser: { id: string } }).adminUser;

      if (adminUser.id === id) {
        return reply.code(400).send({ error: "You cannot ban yourself" });
      }

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "User not found" });

      const user = await prisma.user.update({
        where: { id },
        data: { banned: !existing.banned },
      });

      // If banning, delete all active sessions
      if (user.banned) {
        await prisma.session.deleteMany({ where: { userId: id } });
      }

      return { id: user.id, banned: user.banned };
    }
  );

  // DELETE /api/admin/users/:id — delete a user
  app.delete<{ Params: { id: string } }>(
    "/users/:id",
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = (request as unknown as { adminUser: { id: string } }).adminUser;

      if (adminUser.id === id) {
        return reply.code(400).send({ error: "You cannot delete your own account" });
      }

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "User not found" });

      await prisma.user.delete({ where: { id } });
      return { success: true };
    }
  );
}
