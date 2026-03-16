import type { NextRequest } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

const client = new Auth0Client();

export default async function middleware(req: NextRequest) {
  return client.middleware(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
