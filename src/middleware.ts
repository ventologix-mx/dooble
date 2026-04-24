import { type NextRequest, NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

const client = new Auth0Client();

export default async function middleware(req: NextRequest) {
  const authRes = await client.middleware(req);

  if (req.nextUrl.pathname.startsWith("/auth/")) {
    return authRes;
  }

  const session = await client.getSession(req);

  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|no-autorizado).*)",
  ],
};
