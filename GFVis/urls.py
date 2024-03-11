"""GFVis URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.urls import re_path as url
from controller.views import front, search, showlist, index, reference, changelog, \
    degree, clean, topicflow, hypertree_view, graph

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', front),
    path('list/', showlist),
    path('index/', index),
    path('search/', search),
    path('graph/', graph),
    path('reference/', reference),
    path('changelog/', changelog),
    path('degree/', degree),
    path('topicflow/', topicflow),
    path('clean/', clean),
    path('hypertree/', hypertree_view),
    # url(r'^idx/([0-9]+)', index_id),
]

"""
带斜杠 (/)：
- 当URL模式以斜杠结尾时，例如 path('search/', search)，它匹配的URL必须以斜杠结尾，如 http://example.com/search/。
- 如果用户访问不带斜杠的URL，例如 http://example.com/search，Django会执行一个301永久重定向，将用户重定向到带斜杠的版本。

不带斜杠：
- 当URL模式不以斜杠结尾时，例如 path('search', search)，它匹配的URL不能以斜杠结尾，如 http://example.com/search。
- 如果用户尝试访问带斜杠的版本，例如 http://example.com/search/，那么这不会匹配该URL模式，用户可能会看到一个404错误页面，除非你有其他URL模式匹配这个带斜杠的版本。

使用带斜杠的URL在Web开发中是一种常见的约定，原因有以下几点：

- 目录的模拟：在传统的文件系统和Web服务器中，URL的斜杠通常表示目录。例如，http://example.com/folder/ 可能表示一个目录，而不是一个具体的文件。这种约定使得URL更具有描述性和直观性。
- 避免重复内容：从SEO的角度来看，http://example.com/search 和 http://example.com/search/ 被视为两个不同的页面。使用带斜杠的URL并利用Django的默认行为（将不带斜杠的URL重定向到带斜杠的URL）可以确保只有一个版本的页面被索引，从而避免重复内容问题。
- 相对URL的解析：当使用相对URL（例如<a href="page2">Link</a>）时，带斜杠的URL可以更容易地解析
- 一致性：很多Web框架和CMS系统默认使用带斜杠的URL，因此开发者习惯于这种方式，并在新项目中保持一致性。
- 预期的行为：由于很多网站和Web应用都使用带斜杠的URL，用户可能已经习惯于这种格式，并期望在访问其他网站时看到相同的URL结构。
- 清晰的终止：斜杠为URL提供了一个明确的终止点，这在某些情况下可以帮助避免歧义。
"""