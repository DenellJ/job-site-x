import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Email + password auth. There is no public sign-up flow: the first manager is
// bootstrapped via `users.setupFirstManager` and every other account is created
// by a manager via `users.createUser` (both use `createAccount` server-side).
// Passwords are hashed by the provider (Scrypt).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
