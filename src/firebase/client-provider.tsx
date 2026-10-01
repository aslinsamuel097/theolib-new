
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  const { firestore } = firebaseServices;

  useEffect(() => {
    let lastState: string | null = null;

    const handleVisibilityChange = () => {
      if (!firestore) return;
      
      const currentState = document.hidden ? 'hidden' : 'visible';
      if (currentState === lastState) return;
      lastState = currentState;

      const savedUser = localStorage.getItem('theolib_user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      
      const type = document.hidden ? 'Usage:InactiveIn' : 'Usage:InactiveOut';
      addDocumentNonBlocking(collection(firestore, 'messages'), {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        collegeId: user.collegeId || 'guest',
        type,
        content: `Tab ${document.hidden ? 'Hidden' : 'Visible'}`,
        timestamp: serverTimestamp()
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [firestore]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
      dataConnect={firebaseServices.dataConnect}
    >
      {children}
    </FirebaseProvider>
  );
}
