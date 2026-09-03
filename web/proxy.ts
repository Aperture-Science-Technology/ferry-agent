import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// No route-matching auth logic here: each protected page/layout performs
// its own `auth.protect()` (resource-based checks), per Clerk's current
// guidance. This proxy only establishes the Clerk request context and
// locale routing (/ → /fr, /en/*, …).
export default clerkMiddleware((_auth, request) => {
  if (
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/trpc")
  ) {
    return NextResponse.next();
  }
  return handleI18nRouting(request);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
