import { Prisma } from "../generated/prisma/client.js";

// better-auth's OAuth provider (#514) gives meaning to a missing list: a
// resource with `allowedScopes: null` allows every scope, `[]` allows none; a
// client with `scopes: null` falls back to the server's scopes. Prisma cannot
// store null in a native list — a `String[]` column reads back as `[]` — so
// these optional lists live in `Json?` columns instead, which keep null apart
// from empty. better-auth's Prisma adapter still writes a bare `null` there,
// which Prisma refuses on a JSON column: this turns it into a database NULL.
//
// Kept in step with the optional `string[]` fields of the plugin schema; a
// field missing here fails loudly on the first write that sets it to null.
const NULLABLE_LISTS: Record<string, readonly string[]> = {
  OauthClient: ["scopes", "clientCredentialsScopes", "contacts", "postLogoutRedirectUris", "grantTypes", "responseTypes"],
  OauthResource: ["allowedScopes"],
  OauthAccessToken: ["resources", "requestedUserInfoClaims"],
  OauthRefreshToken: ["resources", "requestedUserInfoClaims"],
  OauthConsent: ["resources", "requestedUserInfoClaims"],
};

type Data = Record<string, unknown>;

function withDbNulls(data: unknown, fields: readonly string[]): unknown {
  if (Array.isArray(data)) return data.map((row) => withDbNulls(row, fields));
  if (!data || typeof data !== "object") return data;
  const copy: Data = { ...(data as Data) };
  for (const field of fields) if (copy[field] === null) copy[field] = Prisma.DbNull;
  return copy;
}

export const oauthNullableLists = Prisma.defineExtension({
  name: "oauth-nullable-lists",
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        const fields = NULLABLE_LISTS[model];
        if (!fields) return query(args);
        const input = args as Data;
        return query({
          ...input,
          ...("data" in input && { data: withDbNulls(input.data, fields) }),
          ...("create" in input && { create: withDbNulls(input.create, fields) }),
          ...("update" in input && { update: withDbNulls(input.update, fields) }),
        } as typeof args);
      },
    },
  },
});
