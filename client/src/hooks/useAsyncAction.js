import { useCallback, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Run one-off API actions (delete, set current, status change) with a pending key
 * for button spinners and automatic success/error toasts.
 */
export function useAsyncAction() {
  const toast = useToast();
  const [pending, setPending] = useState(null);

  const run = useCallback(async (key, action, successMessage) => {
    setPending(key);
    try {
      const result = await action();
      if (successMessage) toast.success(successMessage);
      return { ok: true, result };
    } catch (error) {
      toast.error(error.message);
      return { ok: false, error };
    } finally {
      setPending(null);
    }
  }, [toast]);

  return { run, pending };
}
