import React, { useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useLanguage } from '../../contexts/LanguageContext';

const NotificationSound: React.FC = () => {
  const { socket } = useSocket();
  const { t } = useLanguage();
  const soundPath = 'https://eljoodia.vercel.app/sounds/notification.mp3';

  useEffect(() => {
    if (!socket) return;

    const events = [
      'newNotification',
      'orderCreated',
      'orderApproved',
      'taskAssigned',
      'taskStatusUpdated',
      'taskCompleted',
      'orderStatusUpdated',
      'orderCompleted',
      'orderInTransit',
      'orderDelivered',
      'returnStatusUpdated',
      'missingAssignments',
    ];

    const playSound = () => {
      console.log(`[${new Date().toISOString()}] تشغيل صوت الإشعار: ${soundPath}`);
      const audio = new Audio(soundPath);
      audio.play().catch((err) => {
        console.error(`[${new Date().toISOString()}] خطأ في تشغيل الصوت: ${soundPath}`, err);
        // إعادة المحاولة بعد تفاعل المستخدم
        const retryPlay = () => {
          audio.play().catch((e) => console.error(`[${new Date().toISOString()}] إعادة محاولة تشغيل الصوت فشلت:`, e));
        };
        document.addEventListener('click', retryPlay, { once: true });
      });
    };

    events.forEach((event) => {
      socket.on(event, (data: any) => {
        console.log(`[${new Date().toISOString()}] تلقي حدث ${event}:`, data);
        playSound();
      });
    });

    // تفعيل سياق الصوت بعد التفاعل الأول
    const enableAudioContext = () => {
      const audio = new Audio(soundPath);
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        console.log(`[${new Date().toISOString()}] سياق الصوت مفعل`);
      }).catch((err) => console.error(`[${new Date().toISOString()}] فشل تفعيل سياق الصوت:`, err));
    };
    window.addEventListener('click', enableAudioContext, { once: true });

    return () => {
      events.forEach((event) => socket.off(event));
      window.removeEventListener('click', enableAudioContext);
    };
  }, [socket, t]);

  return null;
};

export default NotificationSound;