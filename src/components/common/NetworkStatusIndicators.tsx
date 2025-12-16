/**
 * Network Status Wrapper
 * 
 * Conditionally renders network status indicators based on user settings
 */

import { OfflineBanner, SlowNetworkWarning } from '../../hooks/useNetworkStatus';
import { useSettingsStore } from '../../store/settingsStore';

export function NetworkStatusIndicators() {
  const showNetworkStatus = useSettingsStore((state) => state.showNetworkStatus);
  
  if (!showNetworkStatus) {
    return null;
  }
  
  return (
    <>
      <OfflineBanner />
      <SlowNetworkWarning />
    </>
  );
}
