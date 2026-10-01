'use client';

import { GoogleAuthProvider, signInWithPopup, Auth } from 'firebase/auth';

export const GOOGLE_DRIVE_FOLDER_ID = "1DyArF92Rg2FX5i7aVPgmt0_rc4Zu3wDN";
export const SUPER_ADMIN_DRIVE_EMAIL = "intheolib@gmail.com";
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

let cachedDriveToken: string | null = null;

export const getCachedDriveToken = (): string | null => {
  if (cachedDriveToken) return cachedDriveToken;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('theolib_drive_token');
      const time = localStorage.getItem('theolib_drive_token_time');
      if (saved && time) {
        const elapsed = Date.now() - parseInt(time, 10);
        // Valid for up to 55 minutes
        if (elapsed < 55 * 60 * 1000) {
          cachedDriveToken = saved;
          return saved;
        } else {
          localStorage.removeItem('theolib_drive_token');
          localStorage.removeItem('theolib_drive_token_time');
        }
      }
    } catch (e) {
      console.warn("Could not read token from localStorage:", e);
    }
  }
  return null;
};

export const setCachedDriveToken = (token: string | null) => {
  cachedDriveToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem('theolib_drive_token', token);
        localStorage.setItem('theolib_drive_token_time', Date.now().toString());
      } else {
        localStorage.removeItem('theolib_drive_token');
        localStorage.removeItem('theolib_drive_token_time');
      }
    } catch (e) {
      console.warn("Could not persist token to localStorage:", e);
    }
  }
};

/**
 * Initiates Google OAuth popup with Drive scope to obtain access token.
 * Pre-configured with login_hint for intheolib@gmail.com.
 */
export async function requestGoogleDriveToken(auth: Auth, forcePrompt = false): Promise<string> {
  const existing = getCachedDriveToken();
  if (existing && !forcePrompt) {
    return existing;
  }

  const provider = new GoogleAuthProvider();
  for (const scope of DRIVE_SCOPES) {
    provider.addScope(scope);
  }
  
  provider.setCustomParameters({
    login_hint: SUPER_ADMIN_DRIVE_EMAIL,
    prompt: forcePrompt ? 'consent select_account' : 'select_account'
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error("Unable to obtain Google Drive access token from authentication result.");
    }

    setCachedDriveToken(accessToken);
    return accessToken;
  } catch (error: any) {
    console.error("Google Drive Auth Error:", error);
    throw error;
  }
}
