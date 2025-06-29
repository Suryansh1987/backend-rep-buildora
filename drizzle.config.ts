import { defineConfig } from 'drizzle-kit';
import "dotenv/config";

export default defineConfig({
  out: './drizzle',
  schema: ['./src/db/message_schema.ts', './src/db/project_schema.ts'], // 👈 multiple schema files
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
