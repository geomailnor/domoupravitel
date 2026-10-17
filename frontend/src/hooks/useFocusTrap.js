import { useEffect } from 'react';

/**
 * Focus trap hook.
 * Задържа Tab / Shift+Tab вътре в контейнера, докато е активен.
 *
 * @param {React.RefObject} containerRef - ref към DOM елемента на модала
 * @param {boolean} isActive - дали да е активен trap-ът (true когато модалът е отворен)
 */
export function useFocusTrap(containerRef, isActive = true, initialFocusRef = null) {
  useEffect(() => {
    if (!isActive) return;
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Намери всички focusable елементи вътре в модала
    const getFocusable = () => {
      return Array.from(
        container.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);   // само видими
    };

    // При отваряне → фокус на първия focusable
    const focusable = getFocusable();
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else if (focusable.length > 0) {
      focusable[0].focus();
    }

    // Handle Tab / Shift+Tab
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab → ако сме на първия, отиваме на последния
        if (document.activeElement === first) {
          e.preventDefault();
          e.stopPropagation();
          last.focus();
        }
      } else {
        // Tab → ако сме на последния, отиваме на първия
        if (document.activeElement === last) {
          e.preventDefault();
          e.stopPropagation();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isActive, containerRef, initialFocusRef]);
}