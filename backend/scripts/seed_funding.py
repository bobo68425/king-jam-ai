"""
募資專案種子資料
================

建立 4 個募資專案與 8 個方案層級（超早鳥、早鳥）

使用方式:
    docker-compose exec backend python scripts/seed_funding.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import FundingProject, FundingTier

# 原價 = 月費 × 6，例：入門 299×6=1794
FUNDING_DATA = [
    {
        "project_code": "blogger",
        "name": "部落客專案",
        "description": "適合部落格寫作者，輕鬆產出高品質文章",
        "target_plan_code": "basic",
        "subscription_months": 6,
        "tiers": [
            {"tier_code": "super_early_bird", "tier_name": "超早鳥", "price": 999, "original": 1794},
            {"tier_code": "early_bird", "tier_name": "早鳥", "price": 1299, "original": 1794},
        ],
    },
    {
        "project_code": "self_media",
        "name": "自媒體專案",
        "description": "適合社群、影音創作者",
        "target_plan_code": "pro",
        "subscription_months": 6,
        "tiers": [
            {"tier_code": "super_early_bird", "tier_name": "超早鳥", "price": 2999, "original": 4194},
            {"tier_code": "early_bird", "tier_name": "早鳥", "price": 3499, "original": 4194},
        ],
    },
    {
        "project_code": "super_editor",
        "name": "超級小編專案",
        "description": "適合一人多工小編",
        "target_plan_code": "pro",
        "subscription_months": 6,
        "tiers": [
            {"tier_code": "super_early_bird", "tier_name": "超早鳥", "price": 2999, "original": 4194},
            {"tier_code": "early_bird", "tier_name": "早鳥", "price": 3499, "original": 4194},
        ],
    },
    {
        "project_code": "startup_boss",
        "name": "新創老闆專案",
        "description": "適合新創團隊",
        "target_plan_code": "enterprise",
        "subscription_months": 6,
        "tiers": [
            {"tier_code": "super_early_bird", "tier_name": "超早鳥", "price": 14999, "original": 22194},
            {"tier_code": "early_bird", "tier_name": "早鳥", "price": 18999, "original": 22194},
        ],
    },
]


def main():
    db = SessionLocal()
    try:
        for i, pdata in enumerate(FUNDING_DATA):
            project = db.query(FundingProject).filter(
                FundingProject.project_code == pdata["project_code"],
            ).first()
            if project:
                print(f"專案已存在: {pdata['project_code']}")
                continue

            project = FundingProject(
                project_code=pdata["project_code"],
                name=pdata["name"],
                description=pdata["description"],
                target_plan_code=pdata["target_plan_code"],
                subscription_months=pdata["subscription_months"],
                sort_order=i + 1,
            )
            db.add(project)
            db.flush()

            for j, tdata in enumerate(pdata["tiers"]):
                tier = FundingTier(
                    project_id=project.id,
                    tier_code=tdata["tier_code"],
                    tier_name=tdata["tier_name"],
                    fundraising_price_twd=tdata["price"],
                    original_price_twd=tdata["original"],
                    sort_order=j + 1,
                )
                db.add(tier)

            print(f"已建立: {pdata['name']} ({len(pdata['tiers'])} 個方案)")
        db.commit()
        print("種子資料完成")
    finally:
        db.close()


if __name__ == "__main__":
    main()
