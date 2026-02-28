// ============================================================
// King Jam AI — Short Video Engine v3.0 Types
// ============================================================

/** 單一場景資料 */
export interface SceneData {
    index: number;
    type: "hook" | "problem" | "solution" | "demonstration" | "cta";
    durationInFrames: number;
    /** AI 生成影片片段 URL (fal.ai) */
    videoUrl?: string;
    /** 備用靜態圖片 URL */
    imageUrl?: string;
    /** 旁白文字 */
    narration: string;
    /** 視覺提示詞 (給 AI 用) */
    visualPrompt: string;
    /** 轉場類型 */
    transition?: TransitionType;
}

/** 時間戳 (字幕對齊) */
export interface Timestamp {
    word: string;
    start: number; // 秒
    end: number;   // 秒
}

/** 字幕群組 (按句對齊) */
export interface SubtitleCue {
    text: string;
    startFrame: number;
    endFrame: number;
}

/** 字幕樣式 */
export interface SubtitleStyle {
    fontSize: number;
    fontColor: string;
    outlineColor: string;
    outlineWidth: number;
    position: "bottom" | "center" | "top";
    fontFamily: string;
}

/** 主題配置 */
export interface ThemeConfig {
    id: string;
    name: string;
    category: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        bg: string;
        text: string;
    };
    fonts: {
        title: string;
        body: string;
        accent: string;
    };
    transitions: TransitionType[];
    progressBarStyle: "minimal" | "gradient" | "neon" | "none";
    subtitlePreset: SubtitleStyle;
    musicMood: string;
    animationIntensity: "subtle" | "moderate" | "dynamic";
}

/** 轉場類型 */
export type TransitionType =
    | "fade"
    | "slide-left"
    | "slide-up"
    | "zoom-in"
    | "zoom-out"
    | "wipe"
    | "dissolve"
    | "glitch"
    | "blur"
    | "none";

/** 影片腳本 */
export interface VideoScript {
    projectId: string;
    title: string;
    description: string;
    totalDurationInFrames: number;
    fps: number;
    width: number;
    height: number;
    aspectRatio: "9:16" | "16:9" | "1:1";
}

/** ShortVideo 主組件 Props */
export interface ShortVideoProps {
    script: VideoScript;
    scenes: SceneData[];
    audioUrl?: string;
    subtitles: SubtitleCue[];
    theme: ThemeConfig;
    musicUrl?: string;
    musicVolume?: number;
    logoUrl?: string;
    showProgressBar?: boolean;
    showWatermark?: boolean;
}

/** 渲染請求 */
export interface RenderRequest {
    props: ShortVideoProps;
    outputFormat?: "mp4" | "webm";
    quality?: "low" | "medium" | "high";
}

/** 渲染結果 */
export interface RenderResult {
    jobId: string;
    status: "queued" | "rendering" | "done" | "error";
    progress?: number;
    videoUrl?: string;
    error?: string;
}
