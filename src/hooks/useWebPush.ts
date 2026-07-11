import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { registerPushSubscription, unregisterPushSubscription } from '../services/notificationService';

const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// VAPID exige a chave pública convertida de base64url para Uint8Array antes
// de ser passada como applicationServerKey.
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const useWebPush = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(!!subscription))
      .catch(() => setIsSubscribed(false));
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      toast.error('Este navegador não suporta notificações push.');
      return;
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublicKey) {
      toast.error('Notificações push ainda não estão configuradas neste ambiente.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        toast.error('Permissão de notificações negada.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await registerPushSubscription(subscription);
      setIsSubscribed(true);
      toast.success('Notificações push ativadas.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar notificações push.');
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unregisterPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success('Notificações push desativadas.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desativar notificações push.');
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
};
