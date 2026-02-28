import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface ProgressBarProps {
    progress: number; // 0-1
    style: "minimal" | "gradient" | "neon" | "none";
    color: string;
    accentColor?: string;
}

/**
 * ProgressBar — 動態進度條
 *
 * 顯示在影片頂部，指示播放進度。
 * 支援多種視覺風格。
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    style,
    color,
    accentColor,
}) => {
    const frame = useCurrentFrame();

    if (style === "none") return null;

    const width = `${Math.min(progress * 100, 100)}%`;

    const barStyles: Record<string, React.CSSProperties> = {
        minimal: {
            background: color,
            height: 4,
            borderRadius: 2,
        },
        gradient: {
            background: `linear-gradient(90deg, ${color}, ${accentColor || color})`,
            height: 5,
            borderRadius: 3,
            boxShadow: `0 0 10px ${color}40`,
        },
        neon: {
            background: color,
            height: 3,
            borderRadius: 2,
            boxShadow: `0 0 8px ${color}, 0 0 20px ${color}60`,
        },
    };

    // 發光脈動效果 (neon 模式)
    const glowIntensity = style === "neon"
        ? interpolate(Math.sin(frame * 0.15), [-1, 1], [0.5, 1])
        : 1;

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: style === "gradient" ? 5 : 4,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                zIndex: 100,
            }}
        >
            <div
                style={{
                    ...barStyles[style],
                    width,
                    opacity: glowIntensity,
                    transition: "none",
                }}
            />
        </div>
    );
};
