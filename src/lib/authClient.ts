import { supabase } from './supabaseClient';

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Avoid crashing or showing red banners on transient LockManager or fetch issues during initial load
      if (error.message.includes('LockManager') || error.message.includes('Failed to fetch')) {
        console.warn("Suppressing getSession error:", error.message);
        return null;
      }
      throw new Error(error.message);
    }
    return data.session;
  } catch (err: any) {
    if (err.message && (err.message.includes('LockManager') || err.message.includes('Failed to fetch'))) {
      console.warn("Suppressing getSession exception:", err.message);
      return null;
    }
    throw err;
  }
}
