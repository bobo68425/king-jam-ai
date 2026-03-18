import React from "react";
import {
    AbsoluteFill,
    Sequence,
    useCurrentFrame,
    useVideoConfig,
    Audio,
    Img,
    Video,
    interpolate,
    spring,
} from "remotion";
import type { ShortVideoProps, SceneData } from "../types";
import { AnimatedText } from "../components/AnimatedText";
import { ProgressBar } from "../components/ProgressBar";
import { LogoWatermark } from "../components/LogoWatermark";
import { SubtitleTrack } from "../components/SubtitleTrack";
import { SceneTransition } from "../components/SceneTransition";
import { AIVideoClip } from "../components/AIVideoClip";

/**
 * ShortVideo — v3.0 引擎核心 Remotion 組件
 *
 * 完全由 Props 驅動，接收:
 * - script: 影片設定 (尺寸、FPS 等)
 * - scenes: 每個場景的資料與 AI 影片 URL
 * - subtitles: 時間戳對齊的字幕
 * - theme: 主題風格
 * - audioUrl: TTS 配音
 * - musicUrl: 背景音樂
 */
export const ShortVideo: React.FC<ShortVideoProps> = ({
    script,
    scenes,
    audioUrl,
    subtitles,
    theme,
    musicUrl,
    musicVolume = 0.3,
    logoUrl,
    showProgressBar = true,
    showWatermark = true,
}) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames, width, height } = useVideoConfig();

    // 計算每個場景的起始 frame
    let cumulativeFrame = 0;
    const sceneOffsets = scenes.map((scene) => {
        const offset = cumulativeFrame;
        cumulativeFrame += scene.durationInFrames;
        return offset;
    });

    // 進度百分比
    const progress = frame / durationInFrames;

    return (
        <AbsoluteFill
            style={{
                backgroundColor: theme.colors.bg,
                fontFamily: theme.fonts.body,
            }}
        >
            {/* ========== 場景層 ========== */}
            {scenes.map((scene, idx) => {
                const startFrame = sceneOffsets[idx];
                const transitionDuration = Math.round(fps * 0.5); // WARN-02 fix: 轉場持續 0.5 秒 (動態計算)
                const prevTransition = idx > 0 ? scenes[idx - 1].transition || "fade" : "none";

                return (
                    <Sequence
                        key={idx}
                        from={startFrame}
                        durationInFrames={scene.durationInFrames}
                        name={`Scene ${idx + 1}: ${scene.type}`}
                    >
                        {/* 轉場效果 */}
                        <SceneTransition
                            type={scene.transition || "fade"}
                            durationInFrames={transitionDuration}
                            direction="in"
                        >
                            {/* AI 生成影片 / 圖片 / 漸變背景 */}
                            <AIVideoClip
                                scene={scene}
                                theme={theme}
                                width={width}
                                height={height}
                            />
                        </SceneTransition>

                        {/* 場景旁白文字 (動畫) */}
                        {scene.narration && (
                            <AnimatedText
                                text={scene.narration}
                                theme={theme}
                                intensity={theme.animationIntensity}
                                position="center"
                                delay={20}
                            />
                        )}
                    </Sequence>
                );
            })}

            {/* ========== 字幕層 ========== */}
            {subtitles.length > 0 && (
                <SubtitleTrack
                    cues={subtitles}
                    style={theme.subtitlePreset}
                    theme={theme}
                />
            )}

            {/* ========== 進度條 ========== */}
            {showProgressBar && theme.progressBarStyle !== "none" && (
                <ProgressBar
                    progress={progress}
                    style={theme.progressBarStyle}
                    color={theme.colors.primary}
                    accentColor={theme.colors.accent}
                />
            )}

            {/* ========== Logo 浮水印 ========== */}
            {showWatermark && (
                <LogoWatermark
                    logoUrl={logoUrl}
                    text="King Jam AI"
                    position="bottom-right"
                    opacity={0.6}
                />
            )}

            {/* ========== TTS 配音 ========== */}
            {audioUrl && (
                <Audio src={audioUrl} volume={1} />
            )}

            {/* ========== 背景音樂 ========== */}
            {musicUrl && (
                <Audio
                    src={musicUrl}
                    volume={interpolate(
                        frame,
                        [0, 15, durationInFrames - 30, durationInFrames],
                        [0, musicVolume, musicVolume, 0],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    )}
                />
            )}
        </AbsoluteFill>
    );
};
