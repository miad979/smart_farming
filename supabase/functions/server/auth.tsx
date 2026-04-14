import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Verify user token and return user info
export async function verifyToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "No authorization header" };
  }

  const token = authHeader.substring(7);
  
  // Check for demo tokens
  if (token.startsWith("demo_token_")) {
    const userId = token.replace("demo_token_", "");
    return { 
      user: { id: userId, aud: "authenticated", role: "authenticated" } as any,
      error: null 
    };
  }
  
  // Check if it's the public anon key (guest mode)
  if (token === Deno.env.get("SUPABASE_ANON_KEY")) {
    return { user: null, error: "Guest mode - no user" };
  }

  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user: data.user, error: null };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }
  
  if (password.length > 100) {
    return { valid: false, error: "Password is too long" };
  }
  
  // Optional: Add more strict requirements
  // const hasUpperCase = /[A-Z]/.test(password);
  // const hasLowerCase = /[a-z]/.test(password);
  // const hasNumber = /[0-9]/.test(password);
  
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || !emailRegex.test(email)) {
    return { valid: false, error: "Invalid email address format" };
  }
  
  return { valid: true };
}