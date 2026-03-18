/**
 * Remotion Cloud Run Render Server
 * =================================
 * Express server that accepts render requests and uses @remotion/renderer
 * to produce MP4 videos. Deployed on Google Cloud Run.
 *
 * POST /render         — Submit render job
 * POST /render-preview — Quick low-res preview render
 * GET  /status/:jobId  — Check render status
 * GET  /health         — Health check
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Renderer is imported dynamically to avoid cold-start overhead
let bundle: typeof import("@remotion/bundler").bundle;
let renderMedia: typeof import("@remotion/renderer").renderMedia;
let selectComposition: typeof import("@remotion/renderer").selectComposition;

// ============================================================
// Cloudflare R2 Client (S3-compatible)
// ============================================================
const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

/** Upload rendered video to Cloudflare R2 and return public URL */
async function uploadToR2(localPath: string, key: string): Promise<string> {
    const fileBuffer = fs.readFileSync(localPath);
    await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: fileBuffer,
        ContentType: "video/mp4",
    }));
    // Clean up local temp file after upload
    try { fs.unlinkSync(localPath); } catch (_) { /* ignore */ }
    return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/** Notify backend on render failure via callback URL */
async function notifyBackendFailure(jobId: string, error: string): Promise<void> {
    const callbackUrl = process.env.RENDER_CALLBACK_URL;
    if (!callbackUrl) return;
    try {
        await fetch(callbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, status: "error", error }),
        });
    } catch (err) {
        console.error(`[RenderServer] Failed to notify backend:`, err);
    }
}

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = parseInt(process.env.PORT || "8080", 10);
const OUTPUT_DIR = "/tmp/renders";
const BUNDLE_PATH = path.join(__dirname, "..", "remotion-bundle");

// Dynamic concurrency: use 75% of available CPUs, minimum 2
const RENDER_CONCURRENCY = Math.max(2, Math.floor(os.cpus().length * 0.75));

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
// Job GC — TTL cleanup (every 10 min, remove jobs older than 30 min)
// ============================================================
setInterval(() => {
    const threshold = Date.now() - 30 * 60 * 1000;
    let cleaned = 0;
    for (const [id, job] of jobs.entries()) {
        if (
            (job.status === "done" || job.status === "error") &&
            job.completedAt && job.completedAt < threshold
        ) {
            jobs.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[RenderServer] 🧹 GC: removed ${cleaned} expired jobs`);
    }
}, 10 * 60 * 1000);

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
                j.completedAt = Date.now();
            }
            // Actively notify backend of failure (WARN-03)
            notifyBackendFailure(jobId, err.message).catch(console.error);
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// POST /render-preview — Quick low-res preview render
// ============================================================
app.post("/render-preview", async (req, res) => {
    try {
        const { props } = req.body;
        if (!props) return res.status(400).json({ error: "Missing props" });

        // Override props for preview: 540x960, lower quality
        const previewProps = {
            ...props,
            script: {
                ...props.script,
                width: 540,
                height: 960,
            }
        };

        const jobId = uuidv4() + "_preview";
        const job: RenderJob = {
            id: jobId,
            status: "queued",
            progress: 0,
            startedAt: Date.now(),
        };
        jobs.set(jobId, job);

        res.json({ jobId, status: "queued" });

        // Use 'low' quality (crf 28) for preview
        renderInBackground(jobId, previewProps, "mp4", "low").catch(console.error);
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
        // BUG-03 fix: entry point is Root.tsx (index.ts does not exist)
        bundlePath = await bundle({
            entryPoint: path.join(__dirname, "Root.tsx"),
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

    // Render with parallel frame processing (OPT-A: dynamic concurrency)
    await renderMedia({
        composition,
        serveUrl: bundlePath,
        codec: outputFormat === "webm" ? "vp8" : "h264",
        outputLocation: outputFile,
        inputProps: props,
        concurrency: RENDER_CONCURRENCY,
        crf: crf[quality] || 23,
        onProgress: ({ progress }: { progress: number }) => {
            job.progress = progress;
        },
    });

    job.status = "done";
    job.progress = 1;
    job.videoPath = outputFile;
    job.completedAt = Date.now();

    // BUG-01 fix: Upload to Cloudflare R2 for persistent, CDN-served storage
    if (process.env.R2_ENDPOINT_URL && process.env.R2_BUCKET_NAME) {
        try {
            const r2Key = `videos/${jobId}.${outputFormat}`;
            const r2Url = await uploadToR2(outputFile, r2Key);
            job.videoUrl = r2Url;
            console.log(`[RenderServer] ☁️  Uploaded to R2: ${r2Url}`);
        } catch (uploadErr: any) {
            console.error(`[RenderServer] R2 upload failed, fallback to local:`, uploadErr.message);
            // Graceful fallback: serve from local /download if R2 fails
            const filename = path.basename(outputFile);
            job.videoUrl = `/download/${filename}`;
        }
    } else {
        // R2 not configured: serve locally (development mode)
        const filename = path.basename(outputFile);
        job.videoUrl = `/download/${filename}`;
        console.warn(`[RenderServer] ⚠️  R2 not configured, serving locally (not suitable for production)`);
    }

    const durationSec = ((job.completedAt! - job.startedAt) / 1000).toFixed(1);
    console.log(`[RenderServer] ✅ Job ${jobId} done in ${durationSec}s → ${job.videoUrl}`);
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
