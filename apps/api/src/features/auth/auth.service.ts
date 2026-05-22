import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { HttpError } from "../../lib/httpError";
import { signAccessToken } from "../../services/tokenService";

const DEFAULT_ROLE = "user";
const USERS_PAGE_SIZE = 200;

type ProfileRow = {
  user_id: string;
  full_name: string;
};

export type SignupInput = {
  email: string;
  password: string;
  full_name: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUserResponse = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUserResponse;
};

function getSupabaseConfig(): { url: string; serviceRoleKey: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[supabase] SUPABASE_URL exists:", !!url);
  console.log("[supabase] SUPABASE_SERVICE_ROLE_KEY exists:", !!serviceRoleKey);
  console.log("[supabase] SUPABASE_ANON_KEY exists:", !!anonKey);

  if (!url || !serviceRoleKey || !anonKey) {
    console.error("[supabase] Missing Supabase configuration.", {
      hasUrl: !!url,
      hasServiceRoleKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey
    });
    throw new Error("Supabase authentication is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY.");
  }

  return { url, serviceRoleKey, anonKey };
}

function createAdminClient(): SupabaseClient {
  try {
    const { url, serviceRoleKey } = getSupabaseConfig();
    console.log("[supabase] Creating admin client", {
      hasUrl: !!url,
      hasServiceRoleKey: !!serviceRoleKey
    });

    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error("[supabase] Failed to create admin client:", error);
    throw error;
  }
}

function createAuthClient(): SupabaseClient {
  try {
    const { url, anonKey } = getSupabaseConfig();
    console.log("[supabase] Creating auth client", {
      hasUrl: !!url,
      hasAnonKey: !!anonKey
    });

    return createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error("[supabase] Failed to create auth client:", error);
    throw error;
  }
}

async function findAuthUserByEmail(adminClient: SupabaseClient, email: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE
    });

    if (error) {
      throw error;
    }

    const existingUser = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    if (data.users.length < USERS_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

function isDuplicateEmailError(error: { message?: string; status?: number } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.status === 422 || message.includes("already been registered") || message.includes("already exists") || message.includes("duplicate key");
}

async function fetchProfile(adminClient: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await adminClient.from("profiles").select("user_id, full_name").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mapUserResponse(user: { id: string; email: string; full_name: string; role?: string }): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role ?? DEFAULT_ROLE
  };
}

async function signup(input: SignupInput): Promise<AuthUserResponse> {
  try {
    console.log("[signup] Starting with email:", input.email);

    const adminClient = createAdminClient();
    console.log("[signup] Admin client created");
    const authClient = createAuthClient();
    console.log("[signup] Auth client created");

    const email = input.email.trim().toLowerCase();
    console.log("[signup] Checking for existing user:", email);

    const existingUser = await findAuthUserByEmail(adminClient, email);
    console.log("[signup] Existing user check result:", existingUser?.id || "none");

    if (existingUser) {
      console.log("[signup] User already exists, throwing 400");
      throw new HttpError(400, "Email already exists");
    }

    console.log("[signup] Creating new user...");
    const { data, error } = await authClient.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          full_name: input.full_name,
          role: DEFAULT_ROLE
        }
      }
    });

    console.log("[signup] Create user response:", {
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message
    });

    if (error) {
      if (isDuplicateEmailError(error)) {
        throw new HttpError(400, "Email already exists");
      }

      throw error;
    }

    const createdUser = data.user;
    if (!createdUser?.id || !createdUser.email) {
      throw new Error("Supabase did not return the created user.");
    }

    console.log("[signup] User created in Supabase auth:", {
      userId: createdUser.id,
      email: createdUser.email
    });

    // Profile created automatically by database trigger

    console.log("[signup] Signup completed for user:", createdUser.id);
    return mapUserResponse({
      id: createdUser.id,
      email: createdUser.email,
      full_name: input.full_name,
      role: DEFAULT_ROLE
    });
  } catch (error) {
    console.error("[signup] Full error:", error);
    console.error("[signup] Exact error message:", error instanceof Error ? error.message : String(error));

    if (error instanceof HttpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown signup error";
    throw new HttpError(500, message);
  }
}

async function login(input: LoginInput): Promise<LoginResponse> {
  const adminClient = createAdminClient();
  const authClient = createAuthClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: input.password
  });

  if (error || !data.user?.id || !data.user.email) {
    throw new HttpError(401, "Invalid email or password");
  }

  const profile = await fetchProfile(adminClient, data.user.id);
  const fullName = profile?.full_name ?? String(data.user.user_metadata.full_name ?? "");
  const role = String(data.user.user_metadata.role ?? DEFAULT_ROLE);

  return {
    token: signAccessToken(data.user.id, data.user.email),
    user: mapUserResponse({
      id: data.user.id,
      email: data.user.email,
      full_name: fullName,
      role
    })
  };
}

async function getCurrentUser(userId: string): Promise<AuthUserResponse> {
  const adminClient = createAdminClient();
  const [{ data, error }, profile] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    fetchProfile(adminClient, userId)
  ]);

  if (error || !data.user?.id || !data.user.email) {
    throw new HttpError(404, "User not found");
  }

  return mapUserResponse({
    id: data.user.id,
    email: data.user.email,
    full_name: profile?.full_name ?? String(data.user.user_metadata.full_name ?? ""),
    role: String(data.user.user_metadata.role ?? DEFAULT_ROLE)
  });
}

async function refresh(refreshToken: string): Promise<{ token: string }> {
  const userId = refreshToken.replace(/^refresh-/, "");

  if (!userId) {
    throw new HttpError(400, "Invalid refresh token");
  }

  const user = await getCurrentUser(userId);
  return {
    token: signAccessToken(user.id, user.email)
  };
}

export const authService = {
  signup,
  login,
  getCurrentUser,
  refresh
};
