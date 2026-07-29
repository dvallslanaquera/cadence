"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Drives the credentials sign-in from the login form. A wrong email or password
 * comes back as a CredentialsSignin AuthError, which we surface as a plain
 * string for the form. The redirect Next throws on success is not an AuthError,
 * so it falls through and is re-thrown for the framework to act on.
 */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}