-- Selection interview location (Teams / Direct_Call). Does not rewrite existing rows.
ALTER TABLE "interviews" ADD COLUMN "interview_location" VARCHAR(50);
