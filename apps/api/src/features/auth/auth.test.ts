import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/traces";
process.env.JWT_SECRET ??= "test-secret-key";
process.env.JWT_EXPIRES_IN ??= "7d";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";
process.env.SUPABASE_ANON_KEY ??= "anon-key";

async function createTestServer() {
  const [{ createApp }, { authService }] = await Promise.all([
    import("../../app"),
    import("./auth.service")
  ]);

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    authService,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

afterEach(() => {
  mock.restoreAll();
});

test("signup success", async (t) => {
  const { authService, baseUrl, close } = await createTestServer();
  t.after(close);

  mock.method(authService, "signup", async () => ({
    id: "user-123",
    email: "user@example.com",
    full_name: "Test User",
    role: "user"
  }));

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "password123",
      full_name: "Test User"
    })
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    id: "user-123",
    email: "user@example.com",
    full_name: "Test User",
    role: "user"
  });
});

test("signup duplicate email returns 400", async (t) => {
  const { authService, baseUrl, close } = await createTestServer();
  t.after(close);

  const { HttpError } = await import("../../lib/httpError");
  mock.method(authService, "signup", async () => {
    throw new HttpError(400, "Email already exists");
  });

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "password123",
      full_name: "Test User"
    })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Email already exists"
  });
});

test("signup missing fields returns 400", async (t) => {
  const { authService, baseUrl, close } = await createTestServer();
  t.after(close);

  const signupMock = mock.method(authService, "signup", async () => ({
    id: "unused",
    email: "unused@example.com",
    full_name: "Unused",
    role: "user"
  }));

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "password123"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(signupMock.mock.callCount(), 0);

  const body = await response.json();
  assert.equal(body.error, "Validation failed");
});

test("login success", async (t) => {
  const { authService, baseUrl, close } = await createTestServer();
  t.after(close);

  mock.method(authService, "login", async () => ({
    token: "jwt_token_here",
    user: {
      id: "user-123",
      email: "user@example.com",
      full_name: "Test User",
      role: "user"
    }
  }));

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "password123"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    token: "jwt_token_here",
    user: {
      id: "user-123",
      email: "user@example.com",
      full_name: "Test User",
      role: "user"
    }
  });
});

test("login invalid credentials returns 401", async (t) => {
  const { authService, baseUrl, close } = await createTestServer();
  t.after(close);

  const { HttpError } = await import("../../lib/httpError");
  mock.method(authService, "login", async () => {
    throw new HttpError(401, "Invalid email or password");
  });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "password123"
    })
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid email or password"
  });
});
