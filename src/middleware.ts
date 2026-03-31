import { type NextRequest, NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

const ALLOWED_DOMAIN = "@ventologix.com";

const client = new Auth0Client();

export default async function middleware(req: NextRequest) {
  const authRes = await client.middleware(req);

  // Let Auth0 handle its own routes (/auth/login, /auth/callback, etc.)
  if (req.nextUrl.pathname.startsWith("/auth/")) {
    return authRes;
  }

  // Check session
  const session = await client.getSession(req);

  // No session → redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check email domain
  const email = session.user.email as string | undefined;
  if (!email || !email.endsWith(ALLOWED_DOMAIN)) {
    // Log out unauthorized user and redirect to login
    return NextResponse.redirect(new URL("/auth/logout", req.url));
  }

  return authRes;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};
