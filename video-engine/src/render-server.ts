/**
 * Remotion Cloud Run Render Server
 * =================================
 * Express server that accepts render requests and uses @remotion/renderer
 * to produce MP4 videos. Deployed on Google Cloud Run.
 * 
 * POST /render — Submit render job
 * GET  /health — Health check
 * GET  /status/:jobId — Check render status
 */

import express from "express";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Renderer is imported dynamically to avoid cold-start overhead
let bundle: typeof import("@remotion/bundler").bundle;
let renderMedia: typeof import("@remotion/renderer").renderMedia;
let selectComposition: typeof import("@remotion/renderer").selectComposition;

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = parseInt(process.env.PORT || "8080", 10);
const OUTPUT_DIR = "/tmp/renders";
const BUNDLE_PATH = path.join(__dirname, "..", "remotion-bundle");

// In-memory job tracking
interface RenderJob {
    id: string;
    status: "queued" | "rendering" | "done" | "error";
    progress: number;
    videoPath?: string;
    videoUrl?: string;
    error?: string;
    startedAt: number;
    completedAt?: number;
}

const jobs = new Map<string, RenderJob>();

// ============================================================
// Ensure output directory
// ============================================================
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================
// Lazy-load Remotion modules (reduce cold start)
// ============================================================
async function loadRemotionModules() {
    if (!renderMedia) {
        const bundler = await import("@remotion/bundler");
        const renderer = await import("@remotion/renderer");
        bundle = bundler.bundle;
        renderMedia = renderer.renderMedia;
        selectComposition = renderer.selectComposition;
        console.log("[RenderServer] ✓ Remotion modules loaded");
    }
}

// ============================================================
// POST /render — Submit render job
// ============================================================
app.post("/render", async (req, res) => {
    try {
        const { props, outputFormat = "mp4", quality = "medium" } = req.body;

        if (!props || !props.script || !props.scenes) {
            return res.status(400).json({ error: "Missing required props" });
        }

        const jobId = uuidv4();
        const job: RenderJob = {
            id: jobId,
            status: "queued",
            progress: 0,
            startedAt: Date.now(),
        };
        jobs.set(jobId, job);

        // Return immediately, render in background
        res.json({ jobId, status: "queued" });

        // Start rendering asynchronously
        renderInBackground(jobId, props, outputFormat, quality).catch((err) => {
            console.error(`[RenderServer] Job ${jobId} failed:`, err);
            const j = jobs.get(jobId);
            if (j) {
                j.status = "error";
                j.error = err.message;
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /status/:jobId — Check render status
// ============================================================
app.get("/status/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }
    res.json({
        jobId: job.id,
        status: job.status,
        progress: Math.round(job.progress * 100),
        videoUrl: job.videoUrl,
        error: job.error,
        durationMs: job.completedAt
            ? job.completedAt - job.startedAt
            : Date.now() - job.startedAt,
    });
});

// ============================================================
// GET /download/:filename — Download rendered video
// ============================================================
app.get("/download/:filename", (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    res.sendFile(filePath);
});

// ============================================================
// GET /health — Health check
// ============================================================
app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
});

// ============================================================
// Background render function
// ============================================================
async function renderInBackground(
    jobId: string,
    props: any,
    outputFormat: string,
    quality: string
) {
    const job = jobs.get(jobId)!;
    job.status = "rendering";

    await loadRemotionModules();

    // Bundle path: use pre-built bundle if available, otherwise bundle on-the-fly
    let bundlePath = BUNDLE_PATH;
    if (!fs.existsSync(bundlePath)) {
        console.log("[RenderServer] Bundling Remotion project...");
        bundlePath = await bundle({
            entryPoint: path.join(__dirname, "index.ts"),
            onProgress: (progress: number) => {
                console.log(`[RenderServer] Bundling: ${Math.round(progress * 100)}%`);
            },
        });
    }

    // Select the composition
    const composition = await selectComposition({
        serveUrl: bundlePath,
        id: "ShortVideo",
        inputProps: props,
    });

    // Output file
    const outputFile = path.join(OUTPUT_DIR, `${jobId}.${outputFormat}`);

    // Quality presets
    const crf: Record<string, number> = {
        low: 28,
        medium: 23,
        high: 18,
    };

    // Render with parallel frame processing
    await renderMedia({
        composition,
        serveUrl: bundlePath,
        codec: outputFormat === "webm" ? "vp8" : "h264",
        outputLocation: outputFile,
        inputProps: props,
        concurrency: 4, // 平行渲染 4 frames
        crf: crf[quality] || 23,
        onProgress: ({ progress }: { progress: number }) => {
            job.progress = progress;
        },
    });

    job.status = "done";
    job.progress = 1;
    job.videoPath = outputFile;
    job.completedAt = Date.now();

    // TODO: Upload to GCS and set job.videoUrl
    // For now, serve locally
    const filename = path.basename(outputFile);
    job.videoUrl = `/download/${filename}`;

    const durationSec = ((job.completedAt - job.startedAt) / 1000).toFixed(1);
    console.log(`[RenderServer] ✅ Job ${jobId} done in ${durationSec}s`);
}

// ============================================================
// Remotion entry point (for bundling)
// ============================================================
export { RemotionRoot } from "./Root";

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
    console.log(`[RenderServer] 🚀 Running on port ${PORT}`);
    console.log(`[RenderServer] Output dir: ${OUTPUT_DIR}`);

    // Pre-load Remotion modules in background
    loadRemotionModules().catch(console.error);
});
