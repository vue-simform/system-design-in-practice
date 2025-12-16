/**
 * Tooltip Component
 * 
 * Displays helpful information on hover for system design concepts
 * Uses portal to prevent layout shifts and overflow issues
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, position = 'right' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spacing = 12;
      const tooltipWidth = 800; // Wider tooltip for 6x2 grid layout
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + spacing;
          
          // If tooltip goes off right edge, show on left instead
          if (left + tooltipWidth > viewportWidth - 16) {
            left = rect.left - spacing - tooltipWidth;
          }
          
          // If still off left edge, align to right edge of viewport
          if (left < 16) {
            left = viewportWidth - tooltipWidth - 16;
          }
          break;
          
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - spacing - tooltipWidth;
          
          // If tooltip goes off left edge, show on right instead
          if (left < 16) {
            left = rect.right + spacing;
          }
          
          // If now off right edge, align to left edge of viewport
          if (left + tooltipWidth > viewportWidth - 16) {
            left = 16;
          }
          break;
          
        case 'top':
          top = rect.top - spacing;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          
          // Keep within horizontal bounds
          if (left < 16) left = 16;
          if (left + tooltipWidth > viewportWidth - 16) {
            left = viewportWidth - tooltipWidth - 16;
          }
          break;
          
        case 'bottom':
          top = rect.bottom + spacing;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          
          // Keep within horizontal bounds
          if (left < 16) left = 16;
          if (left + tooltipWidth > viewportWidth - 16) {
            left = viewportWidth - tooltipWidth - 16;
          }
          break;
      }

      // Constrain top position to viewport
      if (top < 16) {
        top = 16;
      } else if (top > viewportHeight - 100) {
        top = viewportHeight - 100;
      }

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  const getTransformClass = () => {
    switch (position) {
      case 'right':
      case 'left':
        return '-translate-y-1/2';
      case 'top':
        return '-translate-y-full';
      case 'bottom':
        return '';
      default:
        return '';
    }
  };

  const getArrowPosition = () => {
    switch (position) {
      case 'right':
        return 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2';
      case 'left':
        return 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2';
      case 'top':
        return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2';
      case 'bottom':
        return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2';
      default:
        return '';
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, 150); // 150ms delay before showing
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 100); // 100ms delay before hiding
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cursor-help"
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <div
            className={`fixed z-9999 w-[800px] text-sm text-white bg-gray-900 rounded-lg shadow-2xl pointer-events-none transition-opacity duration-200 ${getTransformClass()}`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              maxHeight: 'calc(100vh - 32px)',
              opacity: isVisible ? 1 : 0,
            }}
          >
            <div className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${getArrowPosition()}`}></div>
            <div className="relative overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 64px)' }}>
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
