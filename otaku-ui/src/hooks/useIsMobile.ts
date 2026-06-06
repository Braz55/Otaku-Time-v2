import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth < 768)
  );

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
