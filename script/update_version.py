import pandas as pd
from datetime import datetime

# 1.初始化版本信息
# path = "../csv/version.csv"
# df = pd.read_csv(path, sep=',', header=0)
# data = [['v1.0', datetime(2023, 9, 17), "GeneticFlow System has been officially released."]]
# df = pd.DataFrame(data, columns=["versionID", "date", "updateContent"])
# df.to_csv(path, sep=',', index=False)

# 2.增加新版本信息
path = "../csv/version.csv"
df = pd.read_csv(path, sep=',', header=0)
data = ['v1.2', datetime(2023, 10, 20), "GeneticFlow system has released a new version, incorporating data in the database field and providing visualization."]
df.loc[len(df)] = data
df.to_csv(path, sep=',', index=False)
# 还需要删除日期单元中的时分秒