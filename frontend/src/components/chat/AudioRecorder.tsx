'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

    // Playback state
    const [playbackTime, setPlaybackTime] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Waveform visualization refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    // Ref to track recording state inside animation loop (avoids stale closure)
    const isRecordingRef = useRef(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const drawWaveform = useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            // Use ref instead of state to avoid stale closure
            if (!isRecordingRef.current) return;
            animationFrameRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;

                const grad = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
                grad.addColorStop(0, '#3b82f6');
                grad.addColorStop(1, '#8b5cf6');

                canvasCtx.fillStyle = grad;

                const y = (canvas.height - barHeight) / 2;

                canvasCtx.beginPath();
                canvasCtx.roundRect(x, y, barWidth - 1, barHeight < 2 ? 2 : barHeight, 2);
                canvasCtx.fill();

                x += barWidth + 2;
            }
        };

        draw();
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Pick the best supported MIME type (iOS Safari needs audio/mp4)
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : MediaRecorder.isTypeSupported('audio/mp4')
                        ? 'audio/mp4'
                        : '';

            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            // Audio Context setup for Visualization
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // Menos barras para um visual mais limpo
            analyserRef.current = analyser;
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyser);

            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setPlaybackUrl(url);

                if (audioContextRef.current?.state !== 'closed') {
                    audioContextRef.current?.close();
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };

            mediaRecorder.start(100);
            isRecordingRef.current = true;
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            // Start waveform animation after state ref is set
            drawWaveform();

        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            toast.error('Erro ao acessar o microfone. Verifique as permissões.');
            onCancel();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            isRecordingRef.current = false;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
    };

    useEffect(() => {
        startRecording();
        return () => {
            isRecordingRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                mediaRecorderRef.current.stop();
            }
            if (audioContextRef.current?.state !== 'closed') {
                audioContextRef.current?.close();
            }
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    const handleSend = () => {
        if (audioBlob) {
            onSend(audioBlob);
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setPlaybackTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            if (audioRef.current.duration === Infinity) {
                // Workaround for some browsers not getting webm duration immediately
                audioRef.current.currentTime = 1e101;
                audioRef.current.addEventListener('timeupdate', function getDuration() {
                    this.removeEventListener('timeupdate', getDuration);
                    this.currentTime = 0;
                    setPlaybackDuration(this.duration);
                });
            } else {
                setPlaybackDuration(audioRef.current.duration);
            }
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || playbackDuration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * playbackDuration;
        setPlaybackTime(audioRef.current.currentTime);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 md:p-3 rounded-2xl border border-blue-500/20 shadow-xl w-full max-w-sm ml-auto mr-auto md:mr-0 z-20"
        >
            {playbackUrl && (
                <audio
                    ref={audioRef}
                    src={playbackUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    className="hidden"
                />
            )}

            <div className="flex items-center gap-3 flex-1 overflow-hidden pl-2">
                {isRecording ? (
                    <>
                        {/* Status de Gravação Ativo */}
                        <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="h-2.5 w-2.5 bg-rose-500 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                        />
                        <span className="text-sm font-black text-rose-500 tracking-widest w-12">{formatTime(recordingTime)}</span>

                        {/* Visualizador Waveform Canvas */}
                        <div className="flex-1 h-10 w-full rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-black/20">
                            <canvas
                                ref={canvasRef}
                                className="w-full h-full"
                                width={200}
                                height={40}
                            />
                        </div>

                        <button
                            onClick={stopRecording}
                            className="h-10 w-10 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 rounded-full flex items-center justify-center transition-all flex-shrink-0 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30"
                            title="Parar e ouvir"
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                    </>
                ) : (
                    <>
                        {/* Mini-player de Pré-visualização */}
                        <button
                            onClick={togglePlayback}
                            className="h-10 w-10 bg-blue-100 hover:bg-blue-200 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                        >
                            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                        </button>

                        <div className="flex-1 flex flex-col justify-center px-1">
                            <div
                                className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden cursor-pointer relative"
                                onClick={handleTimelineClick}
                            >
                                <motion.div
                                    className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                                    style={{ width: `${playbackDuration > 0 ? (playbackTime / playbackDuration) * 100 : 0}%` }}
                                    layout
                                />
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[10px] font-bold text-slate-400">{formatTime(playbackTime)}</span>
                                <span className="text-[10px] font-bold text-slate-400">{formatTime(playbackDuration || recordingTime)}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                <button
                    onClick={onCancel}
                    className="h-10 w-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full flex items-center justify-center transition-all"
                    title="Descartar"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
                {!isRecording && audioBlob && (
                    <button
                        onClick={handleSend}
                        className="h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 hover:scale-105 transition-all"
                        title="Enviar Áudio"
                    >
                        <Send className="h-4 w-4 ml-0.5 -mt-0.5" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}
