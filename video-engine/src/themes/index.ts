import type { ThemeConfig, SubtitleStyle, TransitionType } from "../types";

// ============================================================
// 字幕預設樣式
// ============================================================

const subtitleBase: SubtitleStyle = {
    fontSize: 48,
    fontColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 2,
    position: "bottom",
    fontFamily: "'Noto Sans TC', 'Noto Sans SC', sans-serif",
};

const subtitleCentered: SubtitleStyle = {
    ...subtitleBase,
    position: "center",
    fontSize: 52,
    outlineWidth: 3,
};

const subtitleNeon: SubtitleStyle = {
    ...subtitleBase,
    fontColor: "#00FFD1",
    outlineColor: "#0D0D0D",
    outlineWidth: 3,
};

// ============================================================
// 20 組行業模板主題
// ============================================================

const themes: ThemeConfig[] = [
    // =================== 商業 (Business) ===================
    {
        id: "tech_startup",
        name: "科技新創",
        category: "商業",
        colors: { primary: "#6366F1", secondary: "#8B5CF6", accent: "#22D3EE", bg: "#0F172A", text: "#F8FAFC" },
        fonts: { title: "Inter, sans-serif", body: "Inter, sans-serif", accent: "JetBrains Mono, monospace" },
        transitions: ["slide-left", "zoom-in", "fade"],
        progressBarStyle: "neon",
        subtitlePreset: subtitleBase,
        musicMood: "minimal",
        animationIntensity: "dynamic",
    },
    {
        id: "corporate",
        name: "企業形象",
        category: "商業",
        colors: { primary: "#1E40AF", secondary: "#3B82F6", accent: "#F59E0B", bg: "#111827", text: "#F9FAFB" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "serif" },
        transitions: ["fade", "dissolve", "slide-left"],
        progressBarStyle: "minimal",
        subtitlePreset: subtitleBase,
        musicMood: "corporate",
        animationIntensity: "subtle",
    },
    {
        id: "finance",
        name: "金融穩重",
        category: "商業",
        colors: { primary: "#0D9488", secondary: "#115E59", accent: "#D4AF37", bg: "#0C0A09", text: "#FAFAF9" },
        fonts: { title: "Georgia, serif", body: "'Noto Sans TC', sans-serif", accent: "Georgia, serif" },
        transitions: ["fade", "dissolve"],
        progressBarStyle: "minimal",
        subtitlePreset: subtitleBase,
        musicMood: "calm",
        animationIntensity: "subtle",
    },
    {
        id: "luxury_realestate",
        name: "地產豪華",
        category: "商業",
        colors: { primary: "#B8860B", secondary: "#8B6914", accent: "#FFFFFF", bg: "#1A1A1A", text: "#FAF3E0" },
        fonts: { title: "Playfair Display, serif", body: "'Noto Sans TC', sans-serif", accent: "italic serif" },
        transitions: ["dissolve", "zoom-out", "fade"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "epic",
        animationIntensity: "moderate",
    },

    // =================== 生活 (Lifestyle) ===================
    {
        id: "food",
        name: "美食饗宴",
        category: "生活",
        colors: { primary: "#EF4444", secondary: "#F97316", accent: "#FDE68A", bg: "#1C1917", text: "#FFF7ED" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["zoom-in", "slide-up", "fade"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "upbeat",
        animationIntensity: "dynamic",
    },
    {
        id: "travel",
        name: "旅行探索",
        category: "生活",
        colors: { primary: "#0EA5E9", secondary: "#06B6D4", accent: "#F59E0B", bg: "#0C4A6E", text: "#F0F9FF" },
        fonts: { title: "Outfit, sans-serif", body: "'Noto Sans TC', sans-serif", accent: "Outfit, sans-serif" },
        transitions: ["slide-left", "zoom-out", "wipe"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "inspirational",
        animationIntensity: "dynamic",
    },
    {
        id: "fitness",
        name: "健身動感",
        category: "生活",
        colors: { primary: "#10B981", secondary: "#F97316", accent: "#FBBF24", bg: "#111827", text: "#ECFDF5" },
        fonts: { title: "Impact, sans-serif", body: "'Noto Sans TC', sans-serif", accent: "Impact, sans-serif" },
        transitions: ["slide-up", "zoom-in", "glitch"],
        progressBarStyle: "neon",
        subtitlePreset: { ...subtitleBase, fontSize: 54, outlineWidth: 3 },
        musicMood: "upbeat",
        animationIntensity: "dynamic",
    },
    {
        id: "fashion",
        name: "時尚潮流",
        category: "生活",
        colors: { primary: "#EC4899", secondary: "#A855F7", accent: "#FFFFFF", bg: "#0F0F0F", text: "#FDF2F8" },
        fonts: { title: "Didot, serif", body: "'Noto Sans TC', sans-serif", accent: "italic serif" },
        transitions: ["fade", "slide-left", "dissolve"],
        progressBarStyle: "minimal",
        subtitlePreset: subtitleCentered,
        musicMood: "minimal",
        animationIntensity: "moderate",
    },

    // =================== 教育 (Education) ===================
    {
        id: "knowledge",
        name: "知識解說",
        category: "教育",
        colors: { primary: "#3B82F6", secondary: "#60A5FA", accent: "#FBBF24", bg: "#1E293B", text: "#F1F5F9" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "monospace" },
        transitions: ["slide-left", "fade", "zoom-in"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "calm",
        animationIntensity: "moderate",
    },
    {
        id: "course",
        name: "課程教學",
        category: "教育",
        colors: { primary: "#7C3AED", secondary: "#A78BFA", accent: "#34D399", bg: "#1E1B4B", text: "#EDE9FE" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "monospace" },
        transitions: ["fade", "slide-up"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "calm",
        animationIntensity: "subtle",
    },
    {
        id: "kids",
        name: "兒童啟蒙",
        category: "教育",
        colors: { primary: "#F59E0B", secondary: "#10B981", accent: "#EF4444", bg: "#FFFBEB", text: "#1F2937" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["zoom-in", "slide-up", "fade"],
        progressBarStyle: "gradient",
        subtitlePreset: { ...subtitleBase, fontSize: 56, fontColor: "#1F2937", outlineColor: "#FFFFFF", outlineWidth: 3 },
        musicMood: "upbeat",
        animationIntensity: "dynamic",
    },
    {
        id: "ted_pro",
        name: "TED 專業",
        category: "教育",
        colors: { primary: "#DC2626", secondary: "#991B1B", accent: "#FFFFFF", bg: "#1A1A1A", text: "#FFFFFF" },
        fonts: { title: "Helvetica, Arial, sans-serif", body: "'Noto Sans TC', sans-serif", accent: "Helvetica, sans-serif" },
        transitions: ["fade", "dissolve"],
        progressBarStyle: "minimal",
        subtitlePreset: subtitleCentered,
        musicMood: "inspirational",
        animationIntensity: "subtle",
    },

    // =================== 創意 (Creative) ===================
    {
        id: "retro_film",
        name: "復古膠片",
        category: "創意",
        colors: { primary: "#D4A574", secondary: "#8B6914", accent: "#F5E6D3", bg: "#2D1B0E", text: "#F5E6D3" },
        fonts: { title: "Georgia, serif", body: "Georgia, serif", accent: "italic serif" },
        transitions: ["dissolve", "fade"],
        progressBarStyle: "none",
        subtitlePreset: { ...subtitleBase, fontFamily: "Georgia, serif" },
        musicMood: "emotional",
        animationIntensity: "subtle",
    },
    {
        id: "cyberpunk",
        name: "霓虹賽博",
        category: "創意",
        colors: { primary: "#FF0080", secondary: "#00FFFF", accent: "#FFE500", bg: "#0A0A0A", text: "#00FFFF" },
        fonts: { title: "Orbitron, sans-serif", body: "'Noto Sans TC', sans-serif", accent: "monospace" },
        transitions: ["glitch", "slide-left", "zoom-in"],
        progressBarStyle: "neon",
        subtitlePreset: subtitleNeon,
        musicMood: "minimal",
        animationIntensity: "dynamic",
    },
    {
        id: "watercolor",
        name: "水彩夢幻",
        category: "創意",
        colors: { primary: "#F472B6", secondary: "#A78BFA", accent: "#67E8F9", bg: "#FFF1F2", text: "#4A1942" },
        fonts: { title: "Dancing Script, cursive", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["dissolve", "fade", "blur"],
        progressBarStyle: "gradient",
        subtitlePreset: { ...subtitleBase, fontColor: "#4A1942", outlineColor: "#FFFFFF", outlineWidth: 3 },
        musicMood: "emotional",
        animationIntensity: "moderate",
    },
    {
        id: "minimal_bw",
        name: "極簡黑白",
        category: "創意",
        colors: { primary: "#FFFFFF", secondary: "#A3A3A3", accent: "#FFFFFF", bg: "#000000", text: "#FFFFFF" },
        fonts: { title: "Helvetica, sans-serif", body: "'Noto Sans TC', sans-serif", accent: "Helvetica, sans-serif" },
        transitions: ["fade", "dissolve"],
        progressBarStyle: "minimal",
        subtitlePreset: subtitleCentered,
        musicMood: "minimal",
        animationIntensity: "subtle",
    },

    // =================== 節慶 (Seasonal) ===================
    {
        id: "christmas",
        name: "聖誕新年",
        category: "節慶",
        colors: { primary: "#DC2626", secondary: "#16A34A", accent: "#FFD700", bg: "#1A0A0A", text: "#FEF2F2" },
        fonts: { title: "Mountains of Christmas, cursive", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["dissolve", "zoom-in", "fade"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "inspirational",
        animationIntensity: "dynamic",
    },
    {
        id: "valentine",
        name: "情人節",
        category: "節慶",
        colors: { primary: "#F43F5E", secondary: "#FB7185", accent: "#FDE68A", bg: "#1C0A15", text: "#FFF1F2" },
        fonts: { title: "Great Vibes, cursive", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["dissolve", "fade", "blur"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "emotional",
        animationIntensity: "moderate",
    },
    {
        id: "mothers_day",
        name: "母親節",
        category: "節慶",
        colors: { primary: "#F472B6", secondary: "#E879F9", accent: "#FDE68A", bg: "#1A0612", text: "#FDF2F8" },
        fonts: { title: "'Noto Sans TC', sans-serif", body: "'Noto Sans TC', sans-serif", accent: "serif" },
        transitions: ["dissolve", "fade"],
        progressBarStyle: "gradient",
        subtitlePreset: subtitleBase,
        musicMood: "emotional",
        animationIntensity: "subtle",
    },
    {
        id: "birthday",
        name: "生日派對",
        category: "節慶",
        colors: { primary: "#F59E0B", secondary: "#8B5CF6", accent: "#EF4444", bg: "#1E1B4B", text: "#FFFBEB" },
        fonts: { title: "Fredoka One, cursive", body: "'Noto Sans TC', sans-serif", accent: "cursive" },
        transitions: ["zoom-in", "slide-up", "glitch"],
        progressBarStyle: "neon",
        subtitlePreset: { ...subtitleBase, fontSize: 54 },
        musicMood: "upbeat",
        animationIntensity: "dynamic",
    },
];

/** 預設主題 */
export const defaultTheme: ThemeConfig = themes[0]; // tech_startup

/** 所有主題 */
export const allThemes: ThemeConfig[] = themes;

/** 按 ID 查找主題 */
export function getThemeById(id: string): ThemeConfig {
    return themes.find((t) => t.id === id) || defaultTheme;
}

/** 按分類取得主題 */
export function getThemesByCategory(category: string): ThemeConfig[] {
    return themes.filter((t) => t.category === category);
}

/** 所有分類 */
export const themeCategories = ["商業", "生活", "教育", "創意", "節慶"] as const;

export default themes;
