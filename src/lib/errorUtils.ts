export function formatError(err: any, defaultMsg: string = "An unknown error occurred"): string {
  const msg = err?.message || String(err) || defaultMsg;
  if (msg === 'Failed to fetch') {
    return 'Failed to connect to Supabase. Please check your VITE_SUPABASE_URL and ensure the server is reachable.';
  }
  return msg;
}
