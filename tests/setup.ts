// Runs before every test file. Points the app at the isolated test database.
process.env.APP_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/lastplate_test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.APP_SECRET = process.env.APP_SECRET ?? "test-secret-value-that-is-long-enough-0123456789";
process.env.APP_URL = "http://localhost:3000";
process.env.STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage-test";
process.env.AI_API_KEY = ""; // Tests exercise the deterministic fallbacks.
process.env.SMTP_HOST = "";  // Emails are recorded in OutboundEmail, never sent.
process.env.CRON_SECRET = "test-cron-secret-value";
