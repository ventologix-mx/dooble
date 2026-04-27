import { Auth0Client } from "@auth0/nextjs-auth0/server";

const client = new Auth0Client();

export const GET = client.handleAuth();
