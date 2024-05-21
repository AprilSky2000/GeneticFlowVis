# GeneticFlow Visual Analysis System

*注意*：为保证项目运行的稳定性，分离测试和正式环境，开发一律使用测试环境，在正式环境文件夹下不要修改代码，只能pull！

## 测试环境（actcloud:/home/xfl/pyCode/GFVisTest，端口9002）
http://test.genetic-flow.com

1. 数据准备：将现有csv同步到本文件夹中，如
```
rsync -a root@82.156.152.182:/home/xfl/pyCode/GFVis/csv/ csv/
```
2. 环境搭建（在root的base环境下）
```
pip install -r requirements.txt
# 根据系统是Ubuntu/centos，选择包管理器安装Graphviz
sudo apt-get install graphviz graphviz-dev
```
3. 运行命令
```
cd /home/xfl/pyCode/GFVisTest
pkill -f "runserver 0.0.0.0:9002"
nohup python manage.py runserver 0.0.0.0:9002 2>&1 &
```

## 正式环境（actcloud:/home/xfl/pyCode/GFVis，端口9001）

https://genetic-flow.com 端口在9001，在root的base环境下运行
```
cd /home/xfl/pyCode/GFVis
git pull
pkill -f "runserver 0.0.0.0:9001"
nohup python manage.py runserver 0.0.0.0:9001 2>&1 &
```

## 个人环境

```
nohup python manage.py runserver 0.0.0.0:9050 2>&1 &
```

## 增加新领域

```
1. 将数据传输至`csv/` 对应领域目录下，包括papers, links, top_field_authors.csv, paperID2topic.json, field_leaves.csv
2. static/config.json 加入新领域说明
3. 运行script中的update_version.py，加入新版本的说明
```
