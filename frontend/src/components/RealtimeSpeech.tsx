import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

interface RealtimeSpeechProps {
  language: string;
  onTextUpdate: (text: string) => void;
}

const RealtimeSpeech: React.FC<RealtimeSpeechProps> = ({
  language,
  onTextUpdate,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = () => {
    console.log('Cleaning up...');
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const clearDebugFiles = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clear-debug`,
        {
          method: 'POST',
        }
      );
      if (!response.ok) {
        throw new Error('Failed to clear debug files');
      }
    } catch (error) {
      console.error('Error clearing debug files:', error);
    }
  };

  const startRecording = async () => {
    try {
      await clearDebugFiles(); // Clear debug files before starting
      setIsRecording(true);
      setError(null);
      setDebug(['Starting recording...']);

      // Get audio stream with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          sampleSize: 16,
        },
      });
      streamRef.current = stream;

      // Create audio context with specific sample rate
      const audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive',
      });
      audioContextRef.current = audioContext;

      // Create source node
      const source = audioContext.createMediaStreamSource(stream);

      // Load audio worklet
      await audioContext.audioWorklet.addModule('worklets/audio-processor.js');

      // Create worklet node
      const workletNode = new AudioWorkletNode(
        audioContext,
        'audio-processor',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          processorOptions: {
            sampleRate: audioContext.sampleRate,
          },
        }
      );
      workletNodeRef.current = workletNode;

      // Connect nodes
      source.connect(workletNode);
      setDebug((prev) => [...prev, 'Got audio stream']);

      // Connect to WebSocket
      const ws = new WebSocket(`ws://localhost:8000/ws/${language}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        setDebug((prev) => [...prev, 'WebSocket connected']);
        setIsRecording(true);
        setDebug((prev) => [...prev, 'Recording started']);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.text) {
            console.log(data.text);
            onTextUpdate(data.text);
          } else if (data.error) {
            setError(data.error);
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
          setError('Failed to parse message');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket error occurred');
      };

      ws.onclose = () => {
        setDebug((prev) => [...prev, 'WebSocket closed']);
        setIsRecording(false);
        setDebug((prev) => [...prev, 'Recording closed']);
      };

      // Set up worklet message handler
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'debug') {
          // Skip initialization and buffer messages
          if (
            !event.data.message.includes('initialized') &&
            !event.data.message.includes('Sent audio buffer')
          ) {
            setDebug((prev) => [...prev, event.data.message]);
          }
        } else if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(event.data);
            setDebug((prev) => [
              ...prev,
              `Sent audio buffer to backend: ${event.data.byteLength} bytes`,
            ]);
          } catch (err) {
            console.error('Failed to send audio data:', err);
            setError('Failed to send audio data: ' + err);
          }
        }
      };
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording: ' + err);
    }
  };

  const stopRecording = async () => {
    try {
      await clearDebugFiles(); // Clear debug files before stopping
      setIsRecording(false);
      cleanup();
      setDebug((prev) => [...prev, 'Recording closed']);
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording: ' + err);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex justify-center space-x-4'>
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          variant={isRecording ? 'destructive' : 'default'}
          disabled={language.length === 0}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>
      </div>
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className='pt-6 max-h-30 overflow-y-scroll'>
          <pre className='text-xs'>
            {debug.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeSpeech;
