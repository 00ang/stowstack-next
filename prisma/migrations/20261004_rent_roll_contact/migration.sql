-- MISSION.md s12 — optional contact columns on the rent roll, so a CSV move-in
-- can be matched to the lead that inquired. PURELY ADDITIVE: two nullable
-- columns; existing rows and uploads without these columns are unaffected.
ALTER TABLE "facility_pms_rent_roll" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30);
ALTER TABLE "facility_pms_rent_roll" ADD COLUMN IF NOT EXISTS "email" VARCHAR(254);
