import { useState, useRef, useEffect, useCallback } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  error: string | null;
  capture: () => Promise<File | null>;
  stop: () => void;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsActive(true);
      } catch (err: any) {
        if (cancelled) return;
        if (err.name === 'NotAllowedError')
          setError(
            "Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur."
          );
        else if (err.name === 'NotFoundError')
          setError('Aucune caméra trouvée sur cet appareil.');
        else if (err.name === 'NotReadableError')
          setError(
            'La caméra est utilisée par une autre application. Fermez-la et réessayez.'
          );
        else if (err.name === 'OverconstrainedError')
          setError(
            'Caméra arrière non disponible, utilisation de la caméra par défaut.'
          );
        else setError("Erreur lors de l'accès à la caméra.");
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return new Promise(resolve => {
      canvas.toBlob(
        blob => {
          if (!blob) resolve(null);
          else
            resolve(
              new File([blob], `capture-${Date.now()}.jpg`, {
                type: 'image/jpeg',
              })
            );
        },
        'image/jpeg',
        0.8
      );
    });
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  return { videoRef, isActive, error, capture, stop };
}
