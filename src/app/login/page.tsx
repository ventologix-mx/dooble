import { redirect } from "next/navigation";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

const client = new Auth0Client();

export default async function LoginPage() {
  const session = await client.getSession();
  redirect(session ? "/home" : "/auth/login");
}
