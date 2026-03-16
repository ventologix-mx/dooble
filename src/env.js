import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AUTH0_SECRET: z.string().min(1),
    AUTH0_DOMAIN: z.string().min(1),
    APP_BASE_URL: z.string().url(),
    AUTH0_CLIENT_ID: z.string().min(1),
    AUTH0_CLIENT_SECRET: z.string().min(1),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AUTH0_SECRET: process.env.AUTH0_SECRET,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    APP_BASE_URL: process.env.APP_BASE_URL,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
