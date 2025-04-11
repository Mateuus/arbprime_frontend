// src/hooks/useWebSocketClient.ts
import { useEffect } from 'react';
import { wsManager } from '@/services/wsManager';
import { apiGateway } from '@/gateways';

export function useWebSocketClient() {
  useEffect( () => {
    apiGateway.getUserAuth().then((token) => {
      wsManager.connect(token);
    });
  }, []);
}
