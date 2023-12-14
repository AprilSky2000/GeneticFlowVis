import pandas as pd
import os
import sys

field = "visualization"
col = "topic"
raw_directory = "/home/xfl/tmp/visualization/papers/"
directory = f"../csv/{field}/papers/"
if os.path.exists("output") == False:
    os.makedirs("output")

files = os.listdir(directory)
for file in files:
    print(file)
    df1 = pd.read_csv(os.path.join(directory, file), sep=',', index_col=0)
    df2 = pd.read_csv(os.path.join(raw_directory, file), sep=',', index_col=0)
    lst = df2[col].values.tolist()
    df1[col] = lst
    df1.to_csv(os.path.join("output", file), sep=',')