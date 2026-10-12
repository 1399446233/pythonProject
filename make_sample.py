import pandas as pd
import random
from datetime import date, timedelta

random.seed(42)

regions = ["华南", "华东", "华北", "西南"]
products = ["A产品", "B产品", "C产品"]
names = ["张三", "李四", "王五", "赵六"]

rows = []
start = date(2026, 1, 1)
for i in range(60):
    rows.append({
        "日期": start + timedelta(days=random.randint(0, 89)),
        "地区": random.choice(regions),
        "产品": random.choice(products),
        "销售员": random.choice(names),
        "数量": random.randint(1, 20),
        "单价": random.choice([19.9, 29.9, 49.9, 99.0]),
    })

df = pd.DataFrame(rows)
df["金额"] = (df["数量"] * df["单价"]).round(2)
df.to_excel("sales.xlsx", index=False)
print(f"已生成 sales.xlsx，共 {len(df)} 行")
