'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch((error) => {
    console.error('initiateAnonymousSignIn error:', error);
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password).catch((error) => {
    console.error('initiateEmailSignUp error:', error);
  });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch((error) => {
    console.error('initiateEmailSignIn error:', error);
  });
}

/** 
 * Initiate Google Sign-In (non-blocking). 
 */
export function initiateGoogleSignIn(authInstance: Auth): void {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');

  signInWithPopup(authInstance, provider)
    .then((result) => {
      console.log("Google Sign-In successful:", result.user.email);
    })
    .catch((error) => {
      console.error("Firebase Auth Error:", error.code, error.message);
      
      if (typeof window !== 'undefined') {
        const domain = window.location.hostname;
        if (error.code === 'auth/unauthorized-domain') {
          alert(`Unauthorized Domain: Please add "${domain}" to the authorized domains list in your Firebase Console (Authentication > Settings > Authorized domains).`);
        } else if (error.code === 'auth/popup-blocked') {
          alert("Popup Blocked: Please allow popups for this site to sign in with Google.");
        } else if (error.code === 'auth/cancelled-popup-request') {
          console.log("Google sign-in popup closed by user.");
        } else {
          alert(`Google Sign-In Error: ${error.message} (${error.code})`);
        }
      }
    });
}
