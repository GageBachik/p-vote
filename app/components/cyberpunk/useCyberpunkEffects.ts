"use client";

import { useEffect } from "react";

export function useCyberpunkEffects() {
  useEffect(() => {
    // Random flicker effect for elements with cyber-flicker class
    const flickerInterval = setInterval(() => {
      const flickerElements = document.querySelectorAll('.cyber-flicker');
      flickerElements.forEach(el => {
        if (Math.random() > 0.95) {
          const element = el as HTMLElement;
          element.style.opacity = '0.3';
          setTimeout(() => {
            element.style.opacity = '1';
          }, 50);
        }
      });
    }, 100);

    return () => {
      clearInterval(flickerInterval);
    };
  }, []);
}