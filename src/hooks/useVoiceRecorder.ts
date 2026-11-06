import { useState, useRef, useCallback } from 'react';

export interface UseVoiceRecorderReturn {
  /** True if microphone is actively capturing audio */
  isRecordingVoice: boolean;
  /** Seconds elapsed in the current recording session */
  recordingSeconds: number;
  /** Starts or stops the audio recording session */
  toggleVoiceRecording: (
    onRecordingComplete: (audioBlob: Blob, durationSeconds: number) => void,
    onError?: (errMessage: string) => void
  ) => Promise<void>;
}

/**
 * Custom React hook encapsulating HTML5 MediaRecorder API lifecycle,
 * audio streams, and real-time second counting for sovereign voice notes.
 *
 * @returns {UseVoiceRecorderReturn} State and toggle controller for voice recording.
 */
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleVoiceRecording = useCallback(
    async (
      onRecordingComplete: (audioBlob: Blob, durationSeconds: number) => void,
      onError?: (errMessage: string) => void
    ) => {
      if (isRecordingVoice) {
        // Stop recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecordingVoice(false);
        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
      } else {
        // Start recording
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            onError?.('Микрофон не поддерживается в текущем браузере');
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = event => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (audioBlob.size > 0) {
              onRecordingComplete(audioBlob, recordingSeconds);
            }
            setRecordingSeconds(0);
          };

          recorder.start(250);
          setIsRecordingVoice(true);
          setRecordingSeconds(0);
          voiceTimerRef.current = setInterval(() => {
            setRecordingSeconds(prev => prev + 1);
          }, 1000);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Доступ к микрофону заблокирован или отклонён.';
          onError?.(errMsg);
        }
      }
    },
    [isRecordingVoice, recordingSeconds]
  );

  return {
    isRecordingVoice,
    recordingSeconds,
    toggleVoiceRecording,
  };
}
