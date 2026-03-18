import React from "react";
import { AbsoluteFill, Video, Img, useCurrentFrame, interpolate } from "remotion";
import type { SceneData, ThemeConfig } from "../types";

interface AIVideoClipProps {
    scene: SceneData;
    theme: ThemeConfig;
    width: number;
    height: number;
}

/**
 * AIVideoClip — AI 生成影片片段插入
 *
 * 優先顯示 fal.ai 生成的影片，
 * 備用：靜態圖片 + Ken Burns 效果，
 * 最終 fallback：主題漸變背景。
 */
export const AIVideoClip: React.FC<AIVideoClipProps> = ({
    scene,
    theme,
    width,
    height,
}) => {
    const frame = useCurrentFrame();

    // Ken Burns 效果 (圖片緩慢縮放平移)
    const kenBurnsScale = interpolate(
        frame,
        [0, scene.durationInFrames],
        [1, 1.08],
        { extrapolateRight: "clamp" }
    );
    const kenBurnsX = interpolate(
        frame,
        [0, scene.durationInFrames],
        [0, -15],
        { extrapolateRight: "clamp" }
    );

    // 場景類型對應漸變色
    const sceneGradients: Record<string, string> = {
        hook: `linear-gradient(135deg, ${theme.colors.primary}dd, ${theme.colors.accent}cc)`,
        problem: `linear-gradient(135deg, #f97316dd, #ef4444cc)`,
        solution: `linear-gradient(135deg, ${theme.colors.primary}dd, #10b981cc)`,
        demonstration: `linear-gradient(135deg, #3b82f6dd, ${theme.colors.secondary}cc)`,
        cta: `linear-gradient(135deg, ${theme.colors.accent}dd, ${theme.colors.primary}cc)`,
    };

    // 1. AI 生成影片 (fal.ai)
    if (scene.videoUrl) {
        return (
            <AbsoluteFill>
                <Video
                    src={scene.videoUrl}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
                {/* 底部漸變遮罩 (讓字幕更清晰) */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "40%",
                        background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                    }}
                />
            </AbsoluteFill>
        );
    }

    // 2. 靜態圖片 + Ken Burns
    if (scene.imageUrl) {
        return (
            <AbsoluteFill>
                <Img
                    src={scene.imageUrl}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${kenBurnsScale}) translateX(${kenBurnsX}px)`,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "40%",
                        background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                    }}
                />
            </AbsoluteFill>
        );
    }

    // 3. 主題漸變背景 (fallback)
    const gradient = sceneGradients[scene.type] || sceneGradients.hook;

    // WARN-04 fix: 使用 useMemo 預計算粒子參數，減少每一幀的重複計算
    const particleParams = React.useMemo(() => 
        Array.from({ length: 6 }, (_, i) => ({
            freqX: 0.02, phaseX: i * 1.2,
            freqY: 0.015, phaseY: i * 0.8,
            size: 100 + i * 60,
            freqO: 0.03, phaseO: i,
        })), []
    );

    const particles = particleParams.map((p, i) => ({
        x: (Math.sin(frame * p.freqX + p.phaseX) + 1) * 50,
        y: (Math.cos(frame * p.freqY + p.phaseY) + 1) * 50,
        size: p.size,
        opacity: 0.08 + (Math.sin(frame * p.freqO + p.phaseO) + 1) * 0.04,
    }));

    return (
        <AbsoluteFill style={{ background: gradient }}>
            {/* 動態光暈粒子 */}
            {particles.map((p, i) => (
                <div
                    key={i}
                    style={{
                        position: "absolute",
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.15)",
                        filter: `blur(${40 + i * 10}px)`,
                        opacity: p.opacity,
                        transform: "translate(-50%, -50%)",
                    }}
                />
            ))}

            {/* 底部漸變 */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "30%",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.3))",
                }}
            />
        </AbsoluteFill>
    );
};
