require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    '[supabase.js] SUPABASE_URL or SUPABASE_SECRET_KEY not set. ' +
    'Supabase client features (storage, realtime) will be unavailable.'
  );
}

// Secret-key client for server-side use only — bypasses Row Level Security.
// Never expose SUPABASE_SECRET_KEY to the browser or frontend.
const supabase =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: { persistSession: false },
      })
    : null;

module.exports = supabase;
