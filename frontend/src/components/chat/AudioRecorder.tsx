'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface AudioRecorderProps {
    onSend: (blob: Blob) => void;
    onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
                setPlaybackUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            toast.error('Erro ao acessar o microfone. Verifique as permissões.');
            onCancel();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        startRecording();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleSend = () => {
        if (audioBlob) {
            onSend(audioBlob);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center gap-4 bg-gray-50 dark:bg-white/5 p-4 rounded-3xl border border-blue-500/30 shadow-xl"
        >
            <div className="flex items-center gap-3 flex-1">
                {isRecording ? (
                    <>
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="h-3 w-3 bg-red-500 rounded-full"
                        />
                        <span className="text-sm font-black mono text-red-500">{formatTime(recordingTime)}</span>
                        <div className="flex-1 h-8 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden flex items-center px-4">
                            <motion.div
                                className="h-1 bg-blue-500 rounded-full"
                                animate={{ width: ['20%', '60%', '40%', '80%', '30%'] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                        </div>
                        <button
                            onClick={stopRecording}
                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-200 transition-all"
                        >
                            <Square className="h-5 w-5 fill-current" />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl"
                        >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </button>
                        <span className="text-sm font-bold text-gray-500">Áudio Gravado</span>
                        <div className="flex-1" />
                    </>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onCancel}
                    className="p-3 text-gray-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
                {!isRecording && audioBlob && (
                    <button
                        onClick={handleSend}
                        className="h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
                    >
                        <Send className="h-5 w-5 ml-1" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}
