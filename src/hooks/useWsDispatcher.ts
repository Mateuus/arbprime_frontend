import { useEffect } from 'react';
import { wsManager } from '@/services/wsManager';
import { MessageHandlers, isTypedMessage } from './wsMessageTypes';

export function useWsDispatcher(handlers: Partial<MessageHandlers>) {
  useEffect(() => {
    const callback = (msg: unknown) => {
      if (typeof msg !== 'object' || msg === null || !('method' in msg)) return;

      const method = (msg as { method: keyof MessageHandlers }).method;

      if (method && handlers[method]) {
        const handler = handlers[method as keyof MessageHandlers];

        if (handler && isTypedMessage(msg, method)) {
          handler(msg);
        }
      }
    };

    wsManager.subscribe(callback);
    return () => wsManager.unsubscribe(callback);
  }, [handlers]);
}
