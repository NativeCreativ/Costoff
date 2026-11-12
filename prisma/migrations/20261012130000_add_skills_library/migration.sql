-- Skills library: admin-managed categories + skills backing the SkillsSelector component
-- (Demand "Required Skills" / Candidate "Key Skills"). Purely a picker source — demands and
-- candidates keep their existing plain text[] skills columns; nothing here is a foreign key
-- from either of those tables, so renaming/deleting a category or skill never touches an
-- already-saved demand or candidate.

-- CreateTable
CREATE TABLE "skill_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_category_id_name_key" ON "skills"("category_id", "name");

-- CreateIndex
CREATE INDEX "skills_category_id_idx" ON "skills"("category_id");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed defaults (idempotent — ON CONFLICT DO NOTHING so re-running this migration, or a
-- future re-run of the seed block, never duplicates rows or clobbers admin edits already made).
INSERT INTO "skill_categories" ("id", "name", "sort_order") VALUES
  (uuid_generate_v4(), 'Frontend developer', 1),
  (uuid_generate_v4(), 'Backend developer', 2),
  (uuid_generate_v4(), 'Full stack developer', 3),
  (uuid_generate_v4(), 'DevOps engineer', 4),
  (uuid_generate_v4(), 'QA engineer', 5),
  (uuid_generate_v4(), 'Data analyst', 6)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "skills" ("id", "category_id", "name", "sort_order")
SELECT uuid_generate_v4(), c.id, s.name, s.sort_order
FROM (VALUES
  ('Frontend developer', 'HTML', 1),
  ('Frontend developer', 'CSS', 2),
  ('Frontend developer', 'JavaScript', 3),
  ('Frontend developer', 'TypeScript', 4),
  ('Frontend developer', 'React', 5),
  ('Frontend developer', 'Angular', 6),
  ('Frontend developer', 'Vue', 7),
  ('Frontend developer', 'Next.js', 8),
  ('Frontend developer', 'Tailwind CSS', 9),
  ('Frontend developer', 'Redux Toolkit', 10),
  ('Frontend developer', 'Git', 11),
  ('Backend developer', 'Node.js', 1),
  ('Backend developer', 'Express', 2),
  ('Backend developer', 'Python', 3),
  ('Backend developer', 'Java', 4),
  ('Backend developer', 'Spring Boot', 5),
  ('Backend developer', 'REST APIs', 6),
  ('Backend developer', 'SQL', 7),
  ('Backend developer', 'MongoDB', 8),
  ('Backend developer', 'PostgreSQL', 9),
  ('Backend developer', 'Microservices', 10),
  ('Backend developer', 'Git', 11),
  ('Full stack developer', 'React', 1),
  ('Full stack developer', 'Node.js', 2),
  ('Full stack developer', 'Express', 3),
  ('Full stack developer', 'TypeScript', 4),
  ('Full stack developer', 'MongoDB', 5),
  ('Full stack developer', 'PostgreSQL', 6),
  ('Full stack developer', 'REST APIs', 7),
  ('Full stack developer', 'Tailwind CSS', 8),
  ('Full stack developer', 'Git', 9),
  ('DevOps engineer', 'AWS', 1),
  ('DevOps engineer', 'Docker', 2),
  ('DevOps engineer', 'Kubernetes', 3),
  ('DevOps engineer', 'Terraform', 4),
  ('DevOps engineer', 'CI/CD', 5),
  ('DevOps engineer', 'Jenkins', 6),
  ('DevOps engineer', 'Linux', 7),
  ('DevOps engineer', 'Monitoring', 8),
  ('DevOps engineer', 'Git', 9),
  ('QA engineer', 'Manual testing', 1),
  ('QA engineer', 'Selenium', 2),
  ('QA engineer', 'Cypress', 3),
  ('QA engineer', 'Playwright', 4),
  ('QA engineer', 'API testing', 5),
  ('QA engineer', 'Jest', 6),
  ('QA engineer', 'Test cases', 7),
  ('QA engineer', 'Bug tracking', 8),
  ('Data analyst', 'SQL', 1),
  ('Data analyst', 'Excel', 2),
  ('Data analyst', 'Python', 3),
  ('Data analyst', 'Pandas', 4),
  ('Data analyst', 'Power BI', 5),
  ('Data analyst', 'Tableau', 6),
  ('Data analyst', 'Statistics', 7),
  ('Data analyst', 'Data cleaning', 8)
) AS s(category_name, name, sort_order)
JOIN "skill_categories" c ON c.name = s.category_name
ON CONFLICT ("category_id", "name") DO NOTHING;
