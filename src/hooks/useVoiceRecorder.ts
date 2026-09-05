// ── Voice Recording Hook (expo-audio) ──────────────────────────────
// WhatsApp-style voice recording: press to start, press to stop & send.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export type RecordingState = 'idle' | 'recording' | 'stopped';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request mic permission on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        setHasPermission(status.granted);
        if (status.granted) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });
        }
      } catch (e) {
        console.error('Mic permission error:', e);
      }
    })();
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      setHasPermission(true);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    }

    try {
      setAudioUri(null);
      setDuration(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingState('recording');

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
      setRecordingState('idle');
    }
  }, [hasPermission, recorder]);

  const stopRecording = useCallback(async (): Promise<{ uri: string; duration: number } | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recorder.stop();
      const uri = recorder.uri;
      setRecordingState('stopped');
      if (uri) {
        setAudioUri(uri);
        return { uri, duration };
      }
      return null;
    } catch (e) {
      console.error('Failed to stop recording:', e);
      setRecordingState('idle');
      return null;
    }
  }, [recorder, duration]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore
    }
    setRecordingState('idle');
    setAudioUri(null);
    setDuration(0);
  }, [recorder, recorderState.isRecording]);

  const reset = useCallback(() => {
    setRecordingState('idle');
    setAudioUri(null);
    setDuration(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    recordingState,
    isRecording: recorderState.isRecording,
    duration,
    audioUri,
    hasPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
