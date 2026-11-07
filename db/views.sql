-- Anonymous totals of the views on the years ahead. Run once against the D1 database bound as VIEWS:
--   npx wrangler d1 execute fire-age-views --remote --file db/views.sql
CREATE TABLE IF NOT EXISTS views (
  question TEXT NOT NULL,
  option INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (question, option)
);
