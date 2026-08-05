"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/** Bad credentials surface as CredentialsSignin AuthError returned as a string; the success redirect is not an AuthError, so it falls through and is re-thrown for the framework. */
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