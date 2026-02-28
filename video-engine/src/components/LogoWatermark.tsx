import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface LogoWatermarkProps {
    logoUrl?: string;
    text?: string;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    opacity?: number;
    size?: number;
}

/**
 * LogoWatermark — Logo 浮水印
 *
 * 顯示在影片角落，支援圖片或文字 fallback。
 * 帶有呼吸效果微動畫。
 */
export const LogoWatermark: React.FC<LogoWatermarkProps> = ({
    logoUrl,
    text = "King Jam AI",
    position = "bottom-right",
    opacity = 0.6,
    size = 36,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // 呼吸效果
    const breathe = interpolate(
        Math.sin(frame * 0.05),
        [-1, 1],
        [opacity * 0.85, opacity]
    );

    // 入場淡入
    const entryOpacity = interpolate(
        frame,
        [0, 20],
        [0, breathe],
        { extrapolateRight: "clamp" }
    );

    // 出場淡出
    const finalOpacity = interpolate(
        frame,
        [durationInFrames - 15, durationInFrames],
        [entryOpacity, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const posMap: Record<string, React.CSSProperties> = {
        "top-left": { top: 24, left: 24 },
        "top-right": { top: 24, right: 24 },
        "bottom-left": { bottom: 80, left: 24 },
        "bottom-right": { bottom: 80, right: 24 },
    };

    return (
        <div
            style={{
                position: "absolute",
                ...posMap[position],
                opacity: finalOpacity,
                zIndex: 90,
                display: "flex",
                alignItems: "center",
                gap: 8,
            }}
        >
            {logoUrl ? (
                <Img
                    src={logoUrl}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size * 0.2,
                        objectFit: "cover",
                    }}
                />
            ) : (
                <div
                    style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(8px)",
                        borderRadius: 12,
                        padding: "6px 14px",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                >
                    <span
                        style={{
                            color: "rgba(255, 255, 255, 0.8)",
                            fontSize: 14,
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                        }}
                    >
                        {text}
                    </span>
                </div>
            )}
        </div>
    );
};
