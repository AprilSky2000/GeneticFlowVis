# GeneticFlow Visual Analysis System

*注意*：为保证项目运行的稳定性，分离测试和正式环境，开发一律使用测试环境，在正式环境文件夹下不要修改代码，只能pull！

## 测试环境（aliyun:/home/xiaofengli/pyCode/GFVis，端口8080）

1. 数据准备：将现有csv同步到本文件夹中
   ```
   rsync -a root@82.156.152.182:/home/xfl/pyCode/GFVis/csv/ csv/
   ```
2. 环境搭建
   ```
   # 安装需要的pip包
   pip install -r requirements.txt


   # 根据系统是Ubuntu/centos，选择包管理器安装Graphviz
   sudo apt-get install graphviz graphviz-dev
   ```
3. 运行命令
   ```
   pkill -f "runserver 0.0.0.0:8080"
   nohup python manage.py runserver 0.0.0.0:8080 2>&1 &
   ```

## 正式环境（actcloud:/home/xfl/pyCode/GFVis，端口9001）

https://genetic-flow.com 端口在9001
```
su xfl
cd /home/xfl/pyCode/GFVis
conda activate python3.7
pip install -r requirements.txt
git pull
pkill -f "runserver 0.0.0.0:9001"
nohup python manage.py runserver 0.0.0.0:9001 2>&1 &
```

## 增加新领域

### 测试环境

```
1. search.html, list.html中field字典需要加入新领域
2. front.html需要加入新的封面和对应跳转链接
3. 运行script中的update_version.py，加入新版本的说明
4. 运行script中的transmit_data.sh，将数据传送到线上环境
5. 将本次修改推到远程分支
```

### 线上环境

```
1. 运行script中的tar_new_field.sh，获取新领域数据
2. 拉取远程分支
3. 运行script中的update_version.py，加入新版本的说明
```