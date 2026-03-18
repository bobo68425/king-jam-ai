import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * mergeSceneVideos — 多段影片拼接 (突破單段 AI 影片長度限制)
 * 
 * 使用 FFmpeg concat 協議進行無縫拼接。
 * @param sceneVideoPaths 本地影片路徑列表
 * @param outputPath 輸出路徑
 */
export async function mergeSceneVideos(
    sceneVideoPaths: string[], 
    outputPath: string
): Promise<void> {
    if (sceneVideoPaths.length === 0) return;
    if (sceneVideoPaths.length === 1) {
        fs.copyFileSync(sceneVideoPaths[0], outputPath);
        return;
    }

    const listFile = path.join("/tmp", `concat_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
    
    try {
        // 建立 FFmpeg concat 列表
        const content = sceneVideoPaths.map(p => `file '${p}'`).join("\n");
        fs.writeFileSync(listFile, content);

        // 執行拼接指令 (-c copy 表示不重新編碼，速度極快)
        const command = `ffmpeg -f concat -safe 0 -i ${listFile} -c copy ${outputPath}`;
        execSync(command);
    } finally {
        // 清理暫存清單
        if (fs.existsSync(listFile)) {
            fs.unlinkSync(listFile);
        }
    }
}
