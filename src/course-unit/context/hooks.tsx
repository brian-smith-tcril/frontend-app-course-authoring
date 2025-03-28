import { useContext } from 'react';

import { IframeContext, IframeContextType } from './iFrameContext';

export const useIframe = (): IframeContextType => {
  const context = useContext(IframeContext);
  if (!context) {
    throw new Error('useIframe must be used within an IframeProvider');
  }
  return context;
};
