import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface CustomAudioPlayerProps {
    url: string;
    fromMe?: boolean;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ url, fromMe }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            if (audioRef.current.duration === Infinity) {
                audioRef.current.currentTime = 1e101;
                audioRef.current.addEventListener('timeupdate', function getDuration() {
                    this.removeEventListener('timeupdate', getDuration);
                    this.currentTime = 0;
                    setDuration(this.duration);
                });
            } else {
                setDuration(audioRef.current.duration);
            }
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || duration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * duration;
        setCurrentTime(audioRef.current.currentTime);
    };

    return (
        <div className={`flex items-center gap-3 w-full p-2 rounded-2xl ${fromMe ? 'bg-white/10 border border-white/20' : 'bg-primary/5 dark:bg-black/20 border border-primary/10 dark:border-white/5'}`}>
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                className="hidden"
            />

            <button
                onClick={togglePlayPause}
                className={`h-10 w-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all ${fromMe ? 'bg-white text-blue-600 shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105' : 'bg-primary text-white shadow-[0_0_15px_rgba(56,130,246,0.3)] hover:scale-105'}`}
            >
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
            </button>

            <div className="flex-1 flex flex-col justify-center overflow-hidden">
                <div
                    className={`h-2 w-full rounded-full cursor-pointer relative overflow-hidden ${fromMe ? 'bg-black/20' : 'bg-slate-200 dark:bg-slate-700/50'}`}
                    onClick={handleTimelineClick}
                >
                    <motion.div
                        className={`absolute top-0 left-0 h-full rounded-full ${fromMe ? 'bg-white' : 'bg-primary'}`}
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        layout
                    />
                </div>
                <div className={`flex items-center justify-between mt-1.5 text-[10px] font-bold ${fromMe ? 'text-white/80' : 'text-slate-500 delay-100 dark:text-slate-400'}`}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};
