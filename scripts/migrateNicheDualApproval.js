require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  console.log('Altering submissions_current_status_check...');
  await c.query(`
    ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_current_status_check;
    ALTER TABLE submissions ADD CONSTRAINT submissions_current_status_check
      CHECK (((current_status)::text = ANY (ARRAY[
        'sourced', 'submitted_to_spoc', 'submitted_to_am', 'shortlisted_internal', 'sent_to_customer',
        'customer_shortlisted', 'interview_scheduled', 'interviewed', 'selected',
        'shortlist_reject', 'rejected', 'offer_released', 'offer_accepted',
        'onboarding', 'bgv_pending', 'bgv_verified', 'joined', 'dropped', 'backed_out'
      ])));
  `);

  console.log('Altering submissions_review_state_check...');
  await c.query(`
    ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_review_state_check;
    ALTER TABLE submissions ADD CONSTRAINT submissions_review_state_check
      CHECK (((review_state IS NULL) OR ((review_state)::text = ANY (ARRAY['rejected', 'spoc_approved', 'am_approved']))));
  `);

  console.log('Successfully updated constraints on submissions');
  await c.end();
}

main().catch(console.error);
