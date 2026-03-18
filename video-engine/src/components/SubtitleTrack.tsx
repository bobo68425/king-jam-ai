import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { SubtitleCue, SubtitleStyle, ThemeConfig } from "../types";

interface SubtitleTrackProps {
    cues: SubtitleCue[];
    style: SubtitleStyle;
    theme: ThemeConfig;
}

/**
 * SubtitleTrack — 字幕軌道
 *
 * 根據 SubtitleCue 的時間戳顯示/隱藏字幕。
 * 支援入場動畫和多種樣式預設。
 * 時間戳由 OpenAI TTS 回傳後轉換為 Remotion frames。
 */
export const SubtitleTrack: React.FC<SubtitleTrackProps> = ({
    cues,
    style,
    theme,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // 找到當前應該顯示的字幕
    const activeCue = cues.find(
        (cue) => frame >= cue.startFrame && frame <= cue.endFrame
    );

    if (!activeCue) return null;

    // 入場動畫
    const entryProgress = spring({
        frame: frame - activeCue.startFrame,
        fps,
        config: { stiffness: 200, damping: 24 },
    });

    // 出場淡出
    const exitDistance = activeCue.endFrame - frame;
    const exitOpacity = exitDistance < 8
        ? interpolate(exitDistance, [0, 8], [0, 1])
        : 1;

    const opacity = interpolate(entryProgress, [0, 1], [0, 1]) * exitOpacity;
    const translateY = interpolate(entryProgress, [0, 1], [20, 0]);
    const scale = interpolate(entryProgress, [0, 1], [0.95, 1]);

    // BUG-05 fix: 統一計算一次 style，避免重複覆蓋與邏輯混亂
    const containerStyle: React.CSSProperties = (() => {
        const base: React.CSSProperties = {
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            padding: "0 40px",
            opacity,
            zIndex: 50,
            pointerEvents: "none",
        };

        const transform = `translateY(${translateY}px) scale(${scale})`;

        switch (style.position) {
            case "top":
                return { ...base, top: "12%", transform };
            case "center":
                return { 
                    ...base, 
                    top: "50%", 
                    transform: `translateY(calc(-50% + ${translateY}px)) scale(${scale})` 
                };
            case "bottom":
            default:
                return { ...base, bottom: "12%", transform };
        }
    })();

    // 文字描邊效果
    const textShadow = style.outlineWidth > 0
        ? `
      ${style.outlineColor} -${style.outlineWidth}px -${style.outlineWidth}px 0,
      ${style.outlineColor} ${style.outlineWidth}px -${style.outlineWidth}px 0,
      ${style.outlineColor} -${style.outlineWidth}px ${style.outlineWidth}px 0,
      ${style.outlineColor} ${style.outlineWidth}px ${style.outlineWidth}px 0,
      rgba(0,0,0,0.4) 0 4px 12px
    `
        : "0 2px 8px rgba(0,0,0,0.5)";

    return (
        <div style={containerStyle}>
            <p
                style={{
                    color: style.fontColor,
                    fontSize: style.fontSize,
                    fontFamily: style.fontFamily,
                    fontWeight: 800,
                    textAlign: "center",
                    lineHeight: 1.5,
                    margin: 0,
                    textShadow,
                    maxWidth: "90%",
                    wordBreak: "keep-all",
                }}
            >
                {activeCue.text}
            </p>
        </div>
    );
};
