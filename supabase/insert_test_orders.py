#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""批量插入测试订单到 Supabase"""

import json
import urllib.request
from datetime import datetime, timedelta

SUPABASE_URL = "https://gntjfuzhlkhnbbukjomx.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudGpmdXpobGtobmJidWtqb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDcxMDQsImV4cCI6MjEwMTQ4MzEwNH0.R2GZNHFXJApPJ8BY2xufmbGSqWjX4SAa8k3juN_UH5w"

orders = [
    {"id": "YJ20260805002", "phone": "13900139001", "amount": 1000, "actual_pay": 850.00, "discount_rate": 0.85, "pay_method": "alipay", "status": "success"},
    {"id": "YJ20260805003", "phone": "13700137002", "amount": 2000, "actual_pay": 1700.00, "discount_rate": 0.85, "pay_method": "wechat", "status": "processing"},
    {"id": "YJ20260805004", "phone": "13600136003", "amount": 500,  "actual_pay": 425.00,  "discount_rate": 0.85, "pay_method": "alipay", "status": "failed", "fail_reason": "凭证模糊不清"},
    {"id": "YJ20260805005", "phone": "13500135004", "amount": 300,  "actual_pay": 255.00,  "discount_rate": 0.85, "pay_method": "wechat", "status": "failed", "fail_reason": "金额不符"},
    {"id": "YJ20260805006", "phone": "15800158005", "amount": 400,  "actual_pay": 340.00,  "discount_rate": 0.85, "pay_method": "alipay", "status": "success"},
    {"id": "YJ20260805007", "phone": "15900159006", "amount": 1000, "actual_pay": 850.00,  "discount_rate": 0.85, "pay_method": "wechat", "status": "pending"},
    {"id": "YJ20260805008", "phone": "18800188007", "amount": 500,  "actual_pay": 425.00,  "discount_rate": 0.85, "pay_method": "alipay", "status": "success"},
]

success = 0
for o in orders:
    data = json.dumps(o).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/orders",
        data=data,
        method="POST",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                print(f"✅ {o['id']} 状态={o['status']} 金额=¥{o['actual_pay']}")
                success += 1
            else:
                print(f"❌ {o['id']} HTTP {resp.status}")
    except Exception as e:
        print(f"❌ {o['id']} 异常：{e}")

print(f"\n插入完成：{success}/{len(orders)}")
