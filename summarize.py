from pathlib import Path
import pandas as pd

INPUT = Path("sales.xlsx")
OUTPUT = Path("summary.xlsx")

def main():
    if not INPUT.exists():
        print(f"找不到 {INPUT}，请先运行 make_sample.py")
        return

    df = pd.read_excel(INPUT)
    print(f"读取 {INPUT}，共 {len(df)} 行，列：{list(df.columns)}")

    # 需要的列必须存在
    for col in ["日期", "地区", "产品", "销售员", "数量", "单价", "金额"]:
        if col not in df.columns:
            raise ValueError(f"缺少列：{col}")

    df["日期"] = pd.to_datetime(df["日期"])
    df["月份"] = df["日期"].dt.to_period("M").astype(str)

    # 1. 按地区汇总
    by_region = (
        df.groupby("地区", as_index=False)
          .agg(订单数=("金额", "count"),
               总数量=("数量", "sum"),
               总金额=("金额", "sum"))
          .sort_values("总金额", ascending=False)
    )

    # 2. 按产品汇总
    by_product = (
        df.groupby("产品", as_index=False)
          .agg(总数量=("数量", "sum"),
               总金额=("金额", "sum"))
          .sort_values("总金额", ascending=False)
    )

    # 3. 按销售员汇总
    by_seller = (
        df.groupby("销售员", as_index=False)
          .agg(订单数=("金额", "count"),
               总金额=("金额", "sum"))
          .sort_values("总金额", ascending=False)
    )

    # 4. 按月份汇总
    by_month = (
        df.groupby("月份", as_index=False)
          .agg(订单数=("金额", "count"),
               总金额=("金额", "sum"))
          .sort_values("月份")
    )

    # 5. 地区 + 产品 交叉表
    pivot = pd.pivot_table(
        df, index="地区", columns="产品",
        values="金额", aggfunc="sum", fill_value=0
    ).round(2)

    # 写入 Excel，多个 sheet
    with pd.ExcelWriter(OUTPUT, engine="openpyxl") as writer:
        by_region.to_excel(writer, sheet_name="按地区", index=False)
        by_product.to_excel(writer, sheet_name="按产品", index=False)
        by_seller.to_excel(writer, sheet_name="按销售员", index=False)
        by_month.to_excel(writer, sheet_name="按月份", index=False)
        pivot.to_excel(writer, sheet_name="地区产品交叉")
        df.to_excel(writer, sheet_name="原始数据", index=False)

    # 控制台打印重点结果
    print("\n=== 按地区汇总 ===")
    print(by_region.to_string(index=False))

    print("\n=== 按产品汇总 ===")
    print(by_product.to_string(index=False))

    print("\n=== 按月份汇总 ===")
    print(by_month.to_string(index=False))

    total = df["金额"].sum()
    print(f"\n总金额：{total:.2f}")
    print(f"已写入 {OUTPUT}")

if __name__ == "__main__":
    main()
