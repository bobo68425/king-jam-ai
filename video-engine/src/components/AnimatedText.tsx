import React from "react";
import {
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from "remotion";
import type { ThemeConfig } from "../types";

interface AnimatedTextProps {
    text: string;
    theme: ThemeConfig;
    intensity?: "subtle" | "moderate" | "dynamic";
    position?: "top" | "center" | "bottom";
    delay?: number;
    fontSize?: number;
}

/**
 * AnimatedText — 文字入場動畫組件
 *
 * 使用 useCurrentFrame 驅動，支援：
 * - 逐字出現動畫
 * - 彈性滑入效果
 * - 根據主題調整強度
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
    text,
    theme,
    intensity = "moderate",
    position = "center",
    delay = 0,
    fontSize,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // 動畫參數根據強度調整
    const config = {
        subtle: { stiffness: 100, damping: 20, mass: 0.5 },
        moderate: { stiffness: 170, damping: 26, mass: 0.8 },
        dynamic: { stiffness: 250, damping: 18, mass: 1.2 },
    }[intensity];

    // 整體入場動畫
    const entryProgress = spring({
        frame: frame - delay,
        fps,
        config,
    });

    // 透明度
    const opacity = interpolate(entryProgress, [0, 1], [0, 1]);

    // Y 軸位移
    const translateY = interpolate(entryProgress, [0, 1], [40, 0]);

    // 縮放
    const scale = interpolate(entryProgress, [0, 1], [0.9, 1]);

    // 位置
    const positionStyle: React.CSSProperties = {
        top: position === "top" ? "15%" : position === "center" ? "40%" : undefined,
        bottom: position === "bottom" ? "20%" : undefined,
    };

    const computedFontSize = fontSize || (text.length > 20 ? 42 : 56);

    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                ...positionStyle,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "0 60px",
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                zIndex: 10,
            }}
        >
            <div
                style={{
                    background: "rgba(0, 0, 0, 0.45)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 20,
                    padding: "24px 40px",
                    border: `1px solid rgba(255, 255, 255, 0.1)`,
                }}
            >
                <p
                    style={{
                        color: theme.colors.text,
                        fontSize: computedFontSize,
                        fontWeight: 700,
                        fontFamily: theme.fonts.title,
                        lineHeight: 1.4,
                        textAlign: "center",
                        margin: 0,
                        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {text}
                </p>
            </div>
        </div>
    );
};
