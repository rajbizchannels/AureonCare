require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.AC_SB_URL;
const supabaseSecretKey = process.env.AC_SB_SK;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    '[supabase.js] AC_SB_URL or AC_SB_SK not set. ' +
    'Supabase client features (storage, realtime) will be unavailable.'
  );
}

// Secret-key client for server-side use only — bypasses Row Level Security.
// Never expose AC_SB_SK to the browser or frontend.
const supabase =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: { persistSession: false },
      })
    : null;

module.exports = supabase;
