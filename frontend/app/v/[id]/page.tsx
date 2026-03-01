"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Script from "next/script";
import { Loader2 } from "lucide-react";

interface PublicHistoryResponse {
    id: number;
    generation_type: string;
    output_data: any;
    media_cloud_url?: string;
    thumbnail_url?: string;
    fb_pixel_id?: string;
    ga_measurement_id?: string;
    custom_script?: string;
    created_at: string;
}

export default function PublicVideoPlayerPage() {
    const params = useParams();
    const videoId = params.id as string;
    const [data, setData] = useState<PublicHistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [trackedMilestones, setTrackedMilestones] = useState<Set<number>>(new Set());

    useEffect(() => {
        // API is accessed via standard fetch to bypass auth interceptors
        const fetchPublicData = async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
                const res = await fetch(`${backendUrl}/history/public/${videoId}`);
                if (!res.ok) throw new Error("Video not found");
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("Public load err:", err);
            } finally {
                setLoading(false);
            }
        };
        if (videoId) fetchPublicData();
    }, [videoId]);

    const trackVideoEvent = (eventName: string, params: Record<string, any> = {}) => {
        // 1. Google Analytics 4
        if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag("event", eventName, {
                ...params,
                video_id: videoId,
            });
            console.log(`[GA4] Fired: ${eventName}`);
        }
        // 2. Meta Pixel
        if (typeof window !== "undefined" && (window as any).fbq) {
            // Use 'trackCustom' for non-standard FB events
            (window as any).fbq("trackCustom", eventName, {
                ...params,
                video_id: videoId,
            });
            console.log(`[FB] Fired: ${eventName}`);
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const duration = videoRef.current.duration;
        const currentTime = videoRef.current.currentTime;
        if (!duration || duration <= 0) return;

        const progress = (currentTime / duration) * 100;
        const milestones = [25, 50, 75, 100];

        milestones.forEach(milestone => {
            if (progress >= milestone && !trackedMilestones.has(milestone)) {
                trackVideoEvent(`video_play_${milestone}`);
                setTrackedMilestones(prev => {
                    const next = new Set(prev);
                    next.add(milestone);
                    return next;
                });
            }
        });
    };

    if (loading) {
        return (
            <div className="flex bg-black min-h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!data || !data.media_cloud_url) {
        return (
            <div className="flex bg-black min-h-screen items-center justify-center">
                <div className="text-white text-center">
                    <h1 className="text-2xl font-bold mb-2">Video Not Found</h1>
                    <p className="text-slate-400">這支影片不存在或已被移除。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
            {/* 
        ============================================================
        1. Google Analytics 4 (GA4) Injection
        ============================================================
      */}
            {data.ga_measurement_id && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${data.ga_measurement_id}`}
                        strategy="afterInteractive"
                    />
                    <Script id="google-analytics" strategy="afterInteractive">
                        {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${data.ga_measurement_id}');
            `}
                    </Script>
                </>
            )}

            {/* 
        ============================================================
        2. Meta Pixel (FB) Injection
        ============================================================
      */}
            {data.fb_pixel_id && (
                <Script id="meta-pixel" strategy="afterInteractive">
                    {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${data.fb_pixel_id}');
            fbq('track', 'PageView');
          `}
                </Script>
            )}

            {/* 
        ============================================================
        3. Custom Script Injection (Safely sanitized by backend)
        ============================================================
      */}
            {data.custom_script && (
                <div dangerouslySetInnerHTML={{ __html: data.custom_script }} />
            )}

            <div className="w-full max-w-2xl bg-slate-900 rounded-xl overflow-hidden shadow-2xl relative">
                <video
                    ref={videoRef}
                    className="w-full aspect-video outline-none"
                    controls
                    playsInline
                    poster={data.thumbnail_url}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => trackVideoEvent("video_start")}
                >
                    <source src={data.media_cloud_url} type="video/mp4" />
                    您的瀏覽器不支援 HTML5 影片播放。
                </video>
            </div>

        </div>
    );
}
