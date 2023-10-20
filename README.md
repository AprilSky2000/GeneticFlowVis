# Genetic Flow Visual Analysis System

*注意*：为保证项目运行的稳定性，分离测试和正式环境，开发一律使用测试环境，在正式环境文件夹下不要修改代码，只能pull！

本地运行（测试环境）：

```
# 数据准备：将现有csv同步到本文件夹中
rsync -a root@82.156.152.182:/home/xfl/pyCode/GFVis/csv/ csv/
# 环境搭建:
pip install -r requirements.txt
运行命令（端口可自行指定）：
python manage.py runserver 0.0.0.0:9109
```

actcloud运行（正式环境）：

```
su xfl
cd /home/xfl/pyCode/GFVis
git pull
pkill -f "runserver 0.0.0.0:9001"
# 后台运行，日志追加到当前目录的`nohup.out`文件，2>&1 表示将错误输出也重定向到同一个文件。
conda activate python3.7
nohup python manage.py runserver 0.0.0.0:9001 2>&1 &
```
<hr />
增加新领域：

> 测试环境

```
1. search.html, list.html中field字典需要加入新领域
2. front.html需要加入新的封面和对应跳转链接
3. 运行script中的update_version.py，加入新版本的说明
4. 运行script中的transmit_data.sh，将数据传送到线上环境
5. 将本次修改推到远程分支
```

> 线上环境

```
1. 运行script中的tar_new_field.sh，获取新领域数据
2. 拉取远程分支
3. 运行script中的update_version.py，加入新版本的说明
```