'use client';

import { useEffect } from 'react';

export default function TawkToWidget() {
  useEffect(() => {
    // Only load on client side
    if (typeof window === 'undefined') return;

    // Check if Tawk.to is already loaded
    if (window.Tawk_API) return;

    // Initialize Tawk.to with exact code provided
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    (function(){
      const s1 = document.createElement('script');
      const s0 = document.getElementsByTagName('script')[0];
      s1.async = true;
      s1.src = 'https://embed.tawk.to/6933feaf014b431982197101/default';
      s1.charset = 'UTF-8';
      s1.setAttribute('crossorigin', '*');
      if (s0 && s0.parentNode) {
        s0.parentNode.insertBefore(s1, s0);
      } else {
        document.body.appendChild(s1);
      }
    })();
  }, []);

  return null;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
}
