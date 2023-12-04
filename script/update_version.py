import pandas as pd
from datetime import datetime

# 1.初始化版本信息
# path = "../csv/version.csv"
# df = pd.read_csv(path, sep=',', header=0)
# dt = datetime(2023, 11, 29)
# data = [['v1.0', dt.date(), "GeneticFlow System has been officially released."]]
# df = pd.DataFrame(data, columns=["versionID", "date", "updateContent"])
# df.to_csv(path, sep=',', index=False)

# 2.增加新版本信息
path = "../csv/version.csv"
df = pd.read_csv(path, sep=',', header=0)
dt = datetime(2023, 11, 29)
data = ['v1.3', dt.date(), "GeneticFlow system has expanded into the new fields of Computer Graphics."]
df.loc[len(df)] = data
df.to_csv(path, sep=',', index=False)
