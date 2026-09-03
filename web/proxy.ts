import { clerkMiddleware } from "@clerk/nextjs/server";

// No route-matching auth logic here: each protected page/layout performs
// its own `auth.protect()` (resource-based checks), per Clerk's current
// guidance. This proxy only establishes the Clerk request context.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
