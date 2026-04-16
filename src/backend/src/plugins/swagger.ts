import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// Hardcoded API version. Bump alongside `package.json#version` on breaking
// changes. Reading the file dynamically would tie us to where node started
// (different in dev/build/prod) and add filesystem coupling for one number.
const apiVersion = "0.1.0";

const apiTags = [
  { name: "health", description: "Sondes de santé du service" },
  { name: "editions", description: "Éditions du DevFest (lecture publique)" },
  { name: "articles", description: "Articles du blog (lecture publique)" },
  { name: "pages", description: "Pages de contenu (CGU, mentions légales, etc.)" },
  { name: "settings", description: "Paramètres publics du site" },
  { name: "contact", description: "Formulaire de contact" },
  { name: "auth", description: "Authentification (Better Auth) — proxy non documenté ici" },
  { name: "api-keys", description: "Jetons d'API personnels" },
  { name: "admin-editions", description: "Administration des éditions" },
  { name: "admin-articles", description: "Administration des articles" },
  { name: "admin-pages", description: "Administration des pages de contenu" },
  { name: "admin-users", description: "Administration des utilisateurs" },
  { name: "admin-settings", description: "Administration des paramètres" },
  { name: "admin-contact", description: "Administration des messages de contact" },
  { name: "admin-tickets", description: "Administration des tarifs de billetterie" },
  { name: "admin-sponsor-plans", description: "Administration des offres de sponsoring" },
  { name: "admin-images", description: "Administration des fichiers" },
  { name: "admin-cache", description: "Invalidation du cache HTTP" },
  { name: "admin-api-keys", description: "Vue d'ensemble admin des jetons d'API" },
];

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "DevFest Toulouse 2026 — API",
        description:
          "API REST publique du site DevFest Toulouse 2026. " +
          "Authentification : cookie de session (Better Auth, via `/api/auth/*`) " +
          "ou jeton Bearer (`Authorization: Bearer dft_…`) généré depuis " +
          "le back-office (page Profil > Mes jetons d'API).",
        version: apiVersion,
        contact: { email: "contact@devfesttoulouse.fr" },
      },
      servers: [
        { url: "/", description: "Serveur courant" },
      ],
      tags: apiTags,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "Token",
            description: "Jeton d'API au format `dft_<env>_<random>`. À placer dans l'en-tête `Authorization: Bearer <token>`.",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Cookie de session Better Auth (positionné automatiquement après login depuis le back-office).",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
  });
}
