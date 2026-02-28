import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { TransitionType } from "../types";

interface SceneTransitionProps {
    type: TransitionType;
    durationInFrames: number;
    direction: "in" | "out";
    children: React.ReactNode;
}

/**
 * SceneTransition — 場景轉場效果
 *
 * 包裝子內容，在場景開頭/結尾添加轉場動畫。
 * Phase 3 將加入 GLSL Shader 級轉場。
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
    type,
    durationInFrames,
    direction,
    children,
}) => {
    const frame = useCurrentFrame();

    if (type === "none") {
        return <AbsoluteFill>{children}</AbsoluteFill>;
    }

    // 轉場進度 (0→1)
    const progress = interpolate(
        frame,
        [0, durationInFrames],
        direction === "in" ? [0, 1] : [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const transitionStyles: Record<TransitionType, React.CSSProperties> = {
        fade: {
            opacity: progress,
        },
        "slide-left": {
            opacity: Math.min(progress * 2, 1),
            transform: `translateX(${interpolate(progress, [0, 1], [80, 0])}px)`,
        },
        "slide-up": {
            opacity: Math.min(progress * 2, 1),
            transform: `translateY(${interpolate(progress, [0, 1], [60, 0])}px)`,
        },
        "zoom-in": {
            opacity: progress,
            transform: `scale(${interpolate(progress, [0, 1], [1.15, 1])})`,
        },
        "zoom-out": {
            opacity: progress,
            transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})`,
        },
        wipe: {
            clipPath: `inset(0 ${interpolate(progress, [0, 1], [100, 0])}% 0 0)`,
        },
        dissolve: {
            opacity: progress,
            filter: `blur(${interpolate(progress, [0, 1], [8, 0])}px)`,
        },
        glitch: {
            opacity: progress > 0.1 ? 1 : 0,
            transform: progress < 0.5
                ? `translate(${Math.sin(frame * 2) * 5}px, ${Math.cos(frame * 3) * 3}px)`
                : "none",
        },
        blur: {
            opacity: progress,
            filter: `blur(${interpolate(progress, [0, 1], [20, 0])}px)`,
        },
        none: {},
    };

    return (
        <AbsoluteFill style={transitionStyles[type]}>
            {children}
        </AbsoluteFill>
    );
};
