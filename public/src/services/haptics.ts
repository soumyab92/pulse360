// Mobile and modern browser Haptics via navigator.vibrate

export const triggerHaptic = (type: 'tick' | 'phase' | 'success' | 'warning') => {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'tick':
        navigator.vibrate(15);
        break;
      case 'phase':
        navigator.vibrate([25, 40, 25]);
        break;
      case 'success':
        navigator.vibrate([40, 60, 40, 60, 80]);
        break;
      case 'warning':
        navigator.vibrate([60, 50, 60]);
        break;
    }
  } catch {
    // ignore
  }
};

