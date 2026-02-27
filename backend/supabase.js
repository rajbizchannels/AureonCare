require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[supabase.js] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
    'Supabase client features (storage, realtime) will be unavailable.'
  );
}

// Service-role client for server-side use only — bypasses Row Level Security.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser or frontend.
const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      })
    : null;

module.exports = supabase;
