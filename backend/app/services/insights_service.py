"""
成效洞察服務
整合 GA4 + 社群平台數據
"""

import os
import ssl
import certifi
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import aiohttp

from app.models import SocialAccount, ScheduledPost, User

# SSL 上下文
def get_ssl_context():
    return ssl.create_default_context(cafile=certifi.where())


class InsightsService:
    """
    成效洞察服務
    整合各平台的成效數據
    """
    
    META_GRAPH_API = "https://graph.facebook.com/v18.0"
    
    async def get_dashboard_overview(
        self,
        db: Session,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        獲取儀表板概覽數據
        整合所有數據來源
        """
        # 獲取發布統計
        publish_stats = await self.get_publish_stats(db, user_id, days)
        
        # 獲取社群帳號列表
        social_accounts = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.is_active == True
        ).all()
        
        # 整合各平台數據
        platform_insights = []
        for account in social_accounts:
            try:
                insights = await self.get_platform_insights(account, days)
                platform_insights.append(insights)
            except Exception as e:
                platform_insights.append({
                    "platform": account.platform,
                    "error": str(e),
                    "metrics": {}
                })
        
        return {
            "period": {
                "start": (datetime.now() - timedelta(days=days)).isoformat(),
                "end": datetime.now().isoformat(),
                "days": days
            },
            "publish_stats": publish_stats,
            "platforms": platform_insights,
            "summary": self._calculate_summary(publish_stats, platform_insights)
        }
    
    async def get_publish_stats(
        self,
        db: Session,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        獲取發布統計
        """
        start_date = datetime.now() - timedelta(days=days)
        
        # 發布總數
        total_published = db.query(ScheduledPost).filter(
            ScheduledPost.user_id == user_id,
            ScheduledPost.status == "published",
            ScheduledPost.published_at >= start_date
        ).count()
        
        # 按平台分類
        platform_counts = db.query(
            SocialAccount.platform,
            func.count(ScheduledPost.id).label("count")
        ).join(
            ScheduledPost,
            SocialAccount.id == ScheduledPost.social_account_id
        ).filter(
            ScheduledPost.user_id == user_id,
            ScheduledPost.status == "published",
            ScheduledPost.published_at >= start_date
        ).group_by(SocialAccount.platform).all()
        
        # 按日期分類
        daily_counts = db.query(
            func.date(ScheduledPost.published_at).label("date"),
            func.count(ScheduledPost.id).label("count")
        ).filter(
            ScheduledPost.user_id == user_id,
            ScheduledPost.status == "published",
            ScheduledPost.published_at >= start_date
        ).group_by(func.date(ScheduledPost.published_at)).all()
        
        # 失敗統計
        failed_count = db.query(ScheduledPost).filter(
            ScheduledPost.user_id == user_id,
            ScheduledPost.status == "failed",
            ScheduledPost.created_at >= start_date
        ).count()
        
        return {
            "total": total_published,
            "failed": failed_count,
            "success_rate": round((total_published / (total_published + failed_count) * 100) if (total_published + failed_count) > 0 else 100, 1),
            "by_platform": {p: c for p, c in platform_counts},
            "daily": [{"date": str(d), "count": c} for d, c in daily_counts]
        }
    
    async def get_platform_insights(
        self,
        account: SocialAccount,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        獲取單一平台的成效數據
        """
        platform = account.platform.lower()
        
        if platform in ["instagram", "facebook", "threads"]:
            return await self._get_meta_insights(account, days)
        elif platform == "linkedin":
            return await self._get_linkedin_insights(account, days)
        elif platform == "youtube":
            return await self._get_youtube_insights(account, days)
        elif platform == "tiktok":
            return await self._get_tiktok_insights(account, days)
        elif platform == "wordpress":
            return await self._get_wordpress_insights(account, days)
        else:
            return {
                "platform": platform,
                "username": account.platform_username,
                "metrics": {},
                "note": f"Insights not available for {platform}"
            }
    
    async def _get_meta_insights(
        self,
        account: SocialAccount,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 Meta 平台 (Instagram/Facebook) 成效數據
        """
        access_token = account.access_token
        if not access_token:
            return {"platform": account.platform, "error": "No access token"}
        
        platform = account.platform.lower()
        metrics_endpoint = ""
        
        try:
            async with aiohttp.ClientSession() as session:
                if platform == "instagram":
                    # Instagram Insights API
                    ig_user_id = account.platform_user_id
                    metrics_endpoint = f"{self.META_GRAPH_API}/{ig_user_id}/insights"
                    
                    # 獲取帳號層級指標
                    params = {
                        "metric": "impressions,reach,profile_views,follower_count",
                        "period": "day",
                        "access_token": access_token
                    }
                    
                    async with session.get(metrics_endpoint, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            metrics = self._parse_meta_insights(data.get("data", []))
                        else:
                            error_data = await response.json()
                            metrics = {"error": error_data.get("error", {}).get("message", "Unknown error")}
                    
                    # 獲取媒體表現
                    media_insights = await self._get_instagram_media_insights(
                        session, ig_user_id, access_token, days
                    )
                    
                    return {
                        "platform": "instagram",
                        "username": account.platform_username,
                        "avatar": account.platform_avatar,
                        "metrics": metrics,
                        "top_posts": media_insights.get("top_posts", []),
                        "totals": media_insights.get("totals", {})
                    }
                
                elif platform == "facebook":
                    # Facebook Page Insights API
                    page_id = account.platform_user_id
                    page_token = account.extra_settings.get("page_access_token", access_token)
                    
                    metrics_endpoint = f"{self.META_GRAPH_API}/{page_id}/insights"
                    params = {
                        "metric": "page_impressions,page_engaged_users,page_fans,page_views_total",
                        "period": "day",
                        "access_token": page_token
                    }
                    
                    async with session.get(metrics_endpoint, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            metrics = self._parse_meta_insights(data.get("data", []))
                        else:
                            metrics = {}
                    
                    return {
                        "platform": "facebook",
                        "username": account.platform_username,
                        "avatar": account.platform_avatar,
                        "metrics": metrics
                    }
        
        except Exception as e:
            return {
                "platform": account.platform,
                "username": account.platform_username,
                "error": str(e),
                "metrics": {}
            }
        
        return {
            "platform": account.platform,
            "username": account.platform_username,
            "metrics": {}
        }
    
    async def _get_instagram_media_insights(
        self,
        session: aiohttp.ClientSession,
        ig_user_id: str,
        access_token: str,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 Instagram 媒體貼文成效
        """
        try:
            # 獲取最近的媒體
            media_url = f"{self.META_GRAPH_API}/{ig_user_id}/media"
            params = {
                "fields": "id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url",
                "limit": 25,
                "access_token": access_token
            }
            
            async with session.get(media_url, params=params) as response:
                if response.status != 200:
                    return {"top_posts": [], "totals": {}}
                
                data = await response.json()
                media_list = data.get("data", [])
            
            # 獲取每個媒體的洞察數據
            top_posts = []
            total_likes = 0
            total_comments = 0
            total_impressions = 0
            total_reach = 0
            
            for media in media_list[:10]:  # 只取前 10 個
                media_id = media["id"]
                insights_url = f"{self.META_GRAPH_API}/{media_id}/insights"
                
                insight_params = {
                    "metric": "impressions,reach,engagement,saved",
                    "access_token": access_token
                }
                
                async with session.get(insights_url, params=insight_params) as insight_response:
                    insights = {}
                    if insight_response.status == 200:
                        insight_data = await insight_response.json()
                        for item in insight_data.get("data", []):
                            insights[item["name"]] = item["values"][0]["value"]
                
                likes = media.get("like_count", 0)
                comments = media.get("comments_count", 0)
                impressions = insights.get("impressions", 0)
                reach = insights.get("reach", 0)
                
                total_likes += likes
                total_comments += comments
                total_impressions += impressions
                total_reach += reach
                
                top_posts.append({
                    "id": media_id,
                    "caption": (media.get("caption", "") or "")[:100],
                    "type": media.get("media_type"),
                    "thumbnail": media.get("thumbnail_url") or media.get("media_url"),
                    "permalink": media.get("permalink"),
                    "timestamp": media.get("timestamp"),
                    "metrics": {
                        "likes": likes,
                        "comments": comments,
                        "impressions": impressions,
                        "reach": reach,
                        "engagement": insights.get("engagement", 0),
                        "saved": insights.get("saved", 0)
                    }
                })
            
            # 按互動數排序
            top_posts.sort(key=lambda x: x["metrics"]["likes"] + x["metrics"]["comments"], reverse=True)
            
            return {
                "top_posts": top_posts[:5],
                "totals": {
                    "total_likes": total_likes,
                    "total_comments": total_comments,
                    "total_impressions": total_impressions,
                    "total_reach": total_reach,
                    "post_count": len(media_list)
                }
            }
        
        except Exception as e:
            return {"top_posts": [], "totals": {}, "error": str(e)}
    
    def _parse_meta_insights(self, insights_data: List[Dict]) -> Dict[str, Any]:
        """
        解析 Meta 洞察數據
        """
        metrics = {}
        for item in insights_data:
            name = item.get("name", "")
            values = item.get("values", [])
            if values:
                # 取最近一天的數據
                metrics[name] = values[-1].get("value", 0)
        return metrics
    
    async def _get_linkedin_insights(
        self,
        account: SocialAccount,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 LinkedIn 成效數據
        使用 LinkedIn Marketing API
        
        需要的權限: r_organization_social, r_1st_connections_size, w_member_social
        """
        access_token = account.access_token
        if not access_token:
            return {"platform": "linkedin", "error": "No access token"}
        
        LINKEDIN_API = "https://api.linkedin.com/v2"
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0"
                }
                
                # 獲取用戶 ID（如果沒有存儲）
                person_urn = account.platform_user_id
                if not person_urn or not person_urn.startswith("urn:"):
                    # 獲取用戶基本資訊
                    userinfo_url = f"{LINKEDIN_API}/userinfo"
                    async with session.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"}) as response:
                        if response.status == 200:
                            data = await response.json()
                            person_urn = f"urn:li:person:{data.get('sub', '')}"
                        else:
                            return {"platform": "linkedin", "error": "Failed to get user info"}
                
                # 獲取用戶的貼文
                posts_url = f"{LINKEDIN_API}/ugcPosts"
                params = {
                    "q": "authors",
                    "authors": f"List({person_urn})",
                    "count": 50
                }
                
                total_likes = 0
                total_comments = 0
                total_shares = 0
                total_impressions = 0
                post_count = 0
                top_posts = []
                
                async with session.get(posts_url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        elements = data.get("elements", [])
                        
                        for post in elements:
                            post_id = post.get("id", "")
                            post_count += 1
                            
                            # 獲取單個貼文的互動數據
                            social_actions_url = f"{LINKEDIN_API}/socialActions/{post_id}"
                            async with session.get(social_actions_url, headers=headers) as actions_resp:
                                if actions_resp.status == 200:
                                    actions = await actions_resp.json()
                                    likes = actions.get("likesSummary", {}).get("totalLikes", 0)
                                    comments = actions.get("commentsSummary", {}).get("totalFirstLevelComments", 0)
                                    
                                    total_likes += likes
                                    total_comments += comments
                                    
                                    # 記錄熱門貼文
                                    if len(top_posts) < 10:
                                        share_content = post.get("specificContent", {}).get("com.linkedin.ugc.ShareContent", {})
                                        caption = share_content.get("shareCommentary", {}).get("text", "")
                                        top_posts.append({
                                            "id": post_id,
                                            "caption": caption[:100] if caption else "無標題",
                                            "type": "post",
                                            "metrics": {
                                                "likes": likes,
                                                "comments": comments
                                            }
                                        })
                
                # 計算互動率
                engagement_rate = 0
                if total_impressions > 0:
                    engagement_rate = ((total_likes + total_comments) / total_impressions) * 100
                
                # 獲取連結數（1st degree connections）
                connections_count = 0
                try:
                    connections_url = f"{LINKEDIN_API}/networkSizes/{person_urn}?edgeType=FIRST_DEGREE"
                    async with session.get(connections_url, headers=headers) as conn_resp:
                        if conn_resp.status == 200:
                            conn_data = await conn_resp.json()
                            connections_count = conn_data.get("firstDegreeSize", 0)
                except:
                    pass
                
                return {
                    "platform": "linkedin",
                    "username": account.platform_username,
                    "avatar": account.platform_avatar,
                    "metrics": {
                        "connections": connections_count,
                        "follower_count": connections_count,  # LinkedIn 用連結數代表
                    },
                    "totals": {
                        "total_likes": total_likes,
                        "total_comments": total_comments,
                        "total_shares": total_shares,
                        "total_impressions": total_impressions,
                        "engagement_rate": round(engagement_rate, 2),
                        "post_count": post_count
                    },
                    "top_posts": sorted(top_posts, key=lambda x: x["metrics"]["likes"], reverse=True)[:5]
                }
                
        except Exception as e:
            return {
                "platform": "linkedin",
                "username": account.platform_username,
                "avatar": account.platform_avatar,
                "error": str(e),
                "metrics": {}
            }
    
    async def _get_youtube_insights(
        self,
        account: SocialAccount,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 YouTube 成效數據
        """
        access_token = account.access_token
        if not access_token:
            return {"platform": "youtube", "error": "No access token"}
        
        try:
            async with aiohttp.ClientSession() as session:
                # 獲取頻道統計
                channel_url = "https://www.googleapis.com/youtube/v3/channels"
                params = {
                    "part": "statistics,snippet",
                    "mine": "true",
                    "access_token": access_token
                }
                
                async with session.get(channel_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        items = data.get("items", [])
                        if items:
                            channel = items[0]
                            stats = channel.get("statistics", {})
                            return {
                                "platform": "youtube",
                                "username": account.platform_username,
                                "avatar": account.platform_avatar,
                                "metrics": {
                                    "subscribers": int(stats.get("subscriberCount", 0)),
                                    "total_views": int(stats.get("viewCount", 0)),
                                    "video_count": int(stats.get("videoCount", 0))
                                }
                            }
        except Exception as e:
            pass
        
        return {
            "platform": "youtube",
            "username": account.platform_username,
            "metrics": {}
        }
    
    async def _get_tiktok_insights(
        self,
        account: SocialAccount,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 TikTok 成效數據
        使用 TikTok Content Posting API v2
        
        需要的權限: user.info.basic, user.info.stats, video.list
        """
        access_token = account.access_token
        if not access_token:
            return {"platform": "tiktok", "error": "No access token"}
        
        TIKTOK_API = "https://open.tiktokapis.com/v2"
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
                
                # 獲取用戶基本資訊和統計數據
                user_url = f"{TIKTOK_API}/user/info/"
                params = {
                    "fields": "open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count"
                }
                
                follower_count = 0
                following_count = 0
                likes_count = 0
                video_count = 0
                display_name = account.platform_username
                avatar_url = account.platform_avatar
                
                async with session.get(user_url, headers=headers, params=params) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("error", {}).get("code") == "ok":
                            user_data = result.get("data", {}).get("user", {})
                            follower_count = user_data.get("follower_count", 0)
                            following_count = user_data.get("following_count", 0)
                            likes_count = user_data.get("likes_count", 0)
                            video_count = user_data.get("video_count", 0)
                            display_name = user_data.get("display_name", display_name)
                            avatar_url = user_data.get("avatar_url", avatar_url)
                
                # 獲取影片列表和成效
                videos_url = f"{TIKTOK_API}/video/list/"
                video_params = {
                    "fields": "id,title,create_time,cover_image_url,share_url,video_description,duration,like_count,comment_count,share_count,view_count"
                }
                
                total_views = 0
                total_likes = 0
                total_comments = 0
                total_shares = 0
                top_posts = []
                
                # 獲取影片列表
                video_data = {
                    "max_count": 20  # 最多獲取 20 個影片
                }
                
                async with session.post(videos_url, headers=headers, params=video_params, json=video_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("error", {}).get("code") == "ok":
                            videos = result.get("data", {}).get("videos", [])
                            
                            for video in videos:
                                view_count = video.get("view_count", 0)
                                like_count = video.get("like_count", 0)
                                comment_count = video.get("comment_count", 0)
                                share_count = video.get("share_count", 0)
                                
                                total_views += view_count
                                total_likes += like_count
                                total_comments += comment_count
                                total_shares += share_count
                                
                                # 記錄熱門影片
                                if len(top_posts) < 10:
                                    top_posts.append({
                                        "id": video.get("id", ""),
                                        "caption": video.get("video_description", video.get("title", ""))[:100] or "無標題",
                                        "type": "video",
                                        "thumbnail": video.get("cover_image_url"),
                                        "metrics": {
                                            "views": view_count,
                                            "likes": like_count,
                                            "comments": comment_count,
                                            "shares": share_count,
                                            "impressions": view_count
                                        }
                                    })
                
                # 計算互動率
                engagement_rate = 0
                if total_views > 0:
                    engagement_rate = ((total_likes + total_comments + total_shares) / total_views) * 100
                
                return {
                    "platform": "tiktok",
                    "username": display_name or account.platform_username,
                    "avatar": avatar_url or account.platform_avatar,
                    "metrics": {
                        "follower_count": follower_count,
                        "following_count": following_count,
                        "likes_count": likes_count,  # 帳號總獲讚數
                        "video_count": video_count
                    },
                    "totals": {
                        "total_views": total_views,
                        "total_likes": total_likes,
                        "total_comments": total_comments,
                        "total_shares": total_shares,
                        "total_impressions": total_views,
                        "engagement_rate": round(engagement_rate, 2),
                        "post_count": len(top_posts)
                    },
                    "top_posts": sorted(top_posts, key=lambda x: x["metrics"]["views"], reverse=True)[:5]
                }
                
        except Exception as e:
            return {
                "platform": "tiktok",
                "username": account.platform_username,
                "avatar": account.platform_avatar,
                "error": str(e),
                "metrics": {}
            }
    
    async def _get_wordpress_insights(
        self,
        account: SocialAccount,
        days: int
    ) -> Dict[str, Any]:
        """
        獲取 WordPress 成效數據
        透過 WordPress REST API 獲取文章統計
        """
        try:
            site_url = account.platform_username  # 存儲的是網站 URL
            if not site_url:
                site_url = account.extra_settings.get("site_url", "")
            
            if not site_url:
                return {
                    "platform": "wordpress",
                    "username": account.platform_username,
                    "error": "No site URL configured",
                    "metrics": {}
                }
            
            # 確保 URL 格式正確
            if not site_url.startswith("http"):
                site_url = f"https://{site_url}"
            
            connector = aiohttp.TCPConnector(ssl=get_ssl_context())
            async with aiohttp.ClientSession(connector=connector) as session:
                # 獲取文章列表
                posts_url = f"{site_url}/wp-json/wp/v2/posts"
                params = {
                    "per_page": 20,
                    "orderby": "date",
                    "order": "desc",
                    "_fields": "id,title,link,date,status"
                }
                
                # 如果有認證 token，添加到請求頭
                headers = {}
                if account.access_token:
                    headers["Authorization"] = f"Bearer {account.access_token}"
                
                async with session.get(posts_url, params=params, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        posts = await response.json()
                        
                        # 嘗試獲取 Jetpack Stats（如果有安裝）
                        stats = await self._get_wordpress_jetpack_stats(session, site_url, headers)
                        
                        # 獲取 GA4 Property ID
                        extra_settings = account.extra_settings or {}
                        ga4_property_id = extra_settings.get("ga4_property_id")
                        
                        return {
                            "platform": "wordpress",
                            "username": site_url,
                            "avatar": None,
                            "ga4_property_id": ga4_property_id,
                            "metrics": {
                                "total_posts": len(posts),
                                "views": stats.get("views", 0),
                                "visitors": stats.get("visitors", 0),
                            },
                            "totals": {
                                "post_count": len(posts),
                                "total_views": stats.get("views", 0),
                            },
                            "top_posts": [
                                {
                                    "id": str(p.get("id")),
                                    "caption": p.get("title", {}).get("rendered", "")[:100] if isinstance(p.get("title"), dict) else str(p.get("title", ""))[:100],
                                    "type": "ARTICLE",
                                    "permalink": p.get("link"),
                                    "metrics": {
                                        "views": stats.get("post_views", {}).get(str(p.get("id")), 0)
                                    }
                                }
                                for p in posts[:5]
                            ]
                        }
                    else:
                        return {
                            "platform": "wordpress",
                            "username": site_url,
                            "error": f"Failed to fetch posts: HTTP {response.status}",
                            "metrics": {}
                        }
                        
        except asyncio.TimeoutError:
            return {
                "platform": "wordpress",
                "username": account.platform_username,
                "error": "Request timeout",
                "metrics": {}
            }
        except Exception as e:
            return {
                "platform": "wordpress",
                "username": account.platform_username,
                "error": str(e),
                "metrics": {}
            }
    
    async def _get_wordpress_jetpack_stats(
        self,
        session: aiohttp.ClientSession,
        site_url: str,
        headers: dict
    ) -> Dict[str, Any]:
        """
        嘗試獲取 Jetpack 統計數據
        """
        try:
            # Jetpack Stats API (需要 Jetpack 插件)
            stats_url = f"{site_url}/wp-json/jetpack/v4/module/stats/data"
            
            async with session.get(stats_url, headers=headers, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "views": data.get("stats", {}).get("views", 0),
                        "visitors": data.get("stats", {}).get("visitors", 0),
                        "post_views": data.get("top_posts", {})
                    }
        except:
            pass
        
        return {"views": 0, "visitors": 0, "post_views": {}}
    
    def _calculate_summary(
        self,
        publish_stats: Dict[str, Any],
        platform_insights: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        計算綜合摘要
        """
        total_impressions = 0
        total_engagement = 0
        total_followers = 0
        
        for platform in platform_insights:
            metrics = platform.get("metrics", {})
            totals = platform.get("totals", {})
            
            # 累計曝光
            total_impressions += metrics.get("impressions", 0)
            total_impressions += metrics.get("page_impressions", 0)
            total_impressions += totals.get("total_impressions", 0)
            
            # 累計互動
            total_engagement += totals.get("total_likes", 0)
            total_engagement += totals.get("total_comments", 0)
            total_engagement += metrics.get("page_engaged_users", 0)
            
            # 累計粉絲
            total_followers += metrics.get("follower_count", 0)
            total_followers += metrics.get("page_fans", 0)
            total_followers += metrics.get("subscribers", 0)
        
        return {
            "total_posts": publish_stats.get("total", 0),
            "success_rate": publish_stats.get("success_rate", 100),
            "total_impressions": total_impressions,
            "total_engagement": total_engagement,
            "total_followers": total_followers,
            "platforms_connected": len([p for p in platform_insights if not p.get("error")])
        }
    
    async def get_post_performance(
        self,
        db: Session,
        user_id: int,
        post_id: int
    ) -> Dict[str, Any]:
        """
        獲取單一發布貼文的成效數據
        """
        post = db.query(ScheduledPost).filter(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == user_id
        ).first()
        
        if not post:
            return {"error": "Post not found"}
        
        if not post.platform_post_id:
            return {"error": "Post not published or no platform ID"}
        
        account = post.social_account
        if not account:
            return {"error": "Social account not found"}
        
        platform = account.platform.lower()
        access_token = account.access_token
        
        try:
            if platform == "instagram":
                async with aiohttp.ClientSession() as session:
                    insights_url = f"{self.META_GRAPH_API}/{post.platform_post_id}/insights"
                    params = {
                        "metric": "impressions,reach,engagement,saved,shares",
                        "access_token": access_token
                    }
                    
                    async with session.get(insights_url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            metrics = {}
                            for item in data.get("data", []):
                                metrics[item["name"]] = item["values"][0]["value"]
                            
                            return {
                                "post_id": post_id,
                                "platform": platform,
                                "platform_post_id": post.platform_post_id,
                                "platform_post_url": post.platform_post_url,
                                "published_at": post.published_at.isoformat() if post.published_at else None,
                                "metrics": metrics
                            }
            
            elif platform == "facebook":
                async with aiohttp.ClientSession() as session:
                    insights_url = f"{self.META_GRAPH_API}/{post.platform_post_id}/insights"
                    page_token = account.extra_settings.get("page_access_token", access_token)
                    params = {
                        "metric": "post_impressions,post_engaged_users,post_reactions_by_type_total",
                        "access_token": page_token
                    }
                    
                    async with session.get(insights_url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            metrics = {}
                            for item in data.get("data", []):
                                metrics[item["name"]] = item["values"][0]["value"]
                            
                            return {
                                "post_id": post_id,
                                "platform": platform,
                                "platform_post_id": post.platform_post_id,
                                "platform_post_url": post.platform_post_url,
                                "published_at": post.published_at.isoformat() if post.published_at else None,
                                "metrics": metrics
                            }
        
        except Exception as e:
            return {"error": str(e)}
        
        return {
            "post_id": post_id,
            "platform": platform,
            "metrics": {},
            "note": f"Insights not available for {platform}"
        }


# 單例實例
insights_service = InsightsService()
