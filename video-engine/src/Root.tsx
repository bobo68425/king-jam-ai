import React from "react";
import { Composition } from "remotion";
import { ShortVideo } from "./compositions/ShortVideo";
import { defaultTheme } from "./themes";
import type { ShortVideoProps } from "./types";

// 預設 Props (用於 Studio 預覽)
const defaultProps: ShortVideoProps = {
    script: {
        projectId: "preview",
        title: "AI 短影音引擎 v3.0",
        description: "由 King Jam AI 驅動的下一代影片創作體驗",
        totalDurationInFrames: 300, // 10 秒 @ 30fps
        fps: 30,
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
    },
    scenes: [
        {
            index: 0,
            type: "hook",
            durationInFrames: 90,
            narration: "你還在花數小時製作影片嗎？",
            visualPrompt: "Frustrated person editing video on computer",
            transition: "fade",
        },
        {
            index: 1,
            type: "solution",
            durationInFrames: 120,
            narration: "AI 短影音引擎，輸入文字，極速生成專業影片",
            visualPrompt: "Futuristic AI interface generating video content",
            transition: "slide-left",
        },
        {
            index: 2,
            type: "cta",
            durationInFrames: 90,
            narration: "立即體驗，開啟你的創作之旅",
            visualPrompt: "Call to action with glowing button",
            transition: "zoom-in",
        },
    ],
    subtitles: [
        { text: "你還在花數小時製作影片嗎？", startFrame: 10, endFrame: 80 },
        { text: "AI 短影音引擎", startFrame: 100, endFrame: 150 },
        { text: "輸入文字，極速生成專業影片", startFrame: 155, endFrame: 200 },
        { text: "立即體驗，開啟你的創作之旅", startFrame: 220, endFrame: 290 },
    ],
    theme: defaultTheme,
    showProgressBar: true,
    showWatermark: true,
    musicVolume: 0.3,
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="ShortVideo"
                // BUG-04 fix: use ComponentType after unknown for proper casting
                component={ShortVideo as unknown as React.ComponentType<Record<string, unknown>>}
                durationInFrames={defaultProps.script.totalDurationInFrames}
                fps={defaultProps.script.fps}
                width={defaultProps.script.width}
                height={defaultProps.script.height}
                defaultProps={defaultProps}
            />
        </>
    );
};
