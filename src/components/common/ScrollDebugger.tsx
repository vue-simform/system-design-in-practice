/**
 * ScrollDebugger Component
 * 
 * Visual indicator for scroll position tracking (dev mode only).
 * Shows current scroll position and last saved position.
 * 
 * Usage:
 * ```tsx
 * {import.meta.env.DEV && <ScrollDebugger storageKey="feed-page" />}
 * ```
 */

import { useEffect, useState } from 'react';
import { sessionPersistentStorage } from '../../utils/statePersistence';

interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface ScrollDebuggerProps {
  storageKey: string;
}

export function ScrollDebugger({ storageKey }: ScrollDebuggerProps) {
  const [currentScroll, setCurrentScroll] = useState({ x: 0, y: 0 });
  const [savedPosition, setSavedPosition] = useState<ScrollPosition | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Track current scroll position
  useEffect(() => {
    const handleScroll = () => {
      setCurrentScroll({
        x: window.scrollX,
        y: window.scrollY,
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check saved position every second
  useEffect(() => {
    const checkSaved = () => {
      const saved = sessionPersistentStorage.get<ScrollPosition>(`scroll-${storageKey}`);
      setSavedPosition(saved);
      if (saved) {
        setLastSaved(new Date(saved.timestamp));
      }
    };

    checkSaved();
    const interval = setInterval(checkSaved, 1000);
    return () => clearInterval(interval);
  }, [storageKey]);

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg font-mono z-50 max-w-xs">
      <div className="font-bold mb-2 text-yellow-300">Scroll Debug</div>
      
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Current:</span> 
          <span className="ml-2">Y: {Math.round(currentScroll.y)}px</span>
        </div>
        
        {savedPosition ? (
          <>
            <div>
              <span className="text-gray-400">Saved:</span> 
              <span className="ml-2 text-green-400">Y: {Math.round(savedPosition.y)}px</span>
            </div>
            {lastSaved && (
              <div>
                <span className="text-gray-400">Last saved:</span> 
                <span className="ml-2">{lastSaved.toLocaleTimeString()}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Age:</span> 
              <span className="ml-2">{Math.round((Date.now() - savedPosition.timestamp) / 1000)}s ago</span>
            </div>
          </>
        ) : (
          <div className="text-red-400">No saved position</div>
        )}
        
        <div className="pt-2 border-t border-gray-600 mt-2">
          <span className="text-gray-400">Key:</span> 
          <span className="ml-2 text-blue-400">{storageKey}</span>
        </div>
      </div>
    </div>
  );
}
