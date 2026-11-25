/* Configuration. Placeholders only: never put secrets or service-role keys in frontend code.
   MODE 'mock'       -> local sample data (development only, clearly labelled in the UI).
   MODE 'production' -> real API via api-client.js. Failures are shown; they never fall back to mock data. */
window.ALPHEX_CONFIG = Object.freeze({
  MODE: 'mock',
  API_BASE_URL: 'https://api.example.invalid/api/v1',   // placeholder
  SUPABASE_URL: '',                                     // placeholder (public project URL)
  SUPABASE_ANON_KEY: '',                                // placeholder (public anon key only)
  STORAGE_BASE_URL: '',                                 // placeholder
  REQUEST_TIMEOUT_MS: 15000,
  MAX_UPLOAD_BYTES: 50 * 1024 * 1024                    // client-side limit; backend must enforce its own
});
