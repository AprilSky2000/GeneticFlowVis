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
from controller.views import front, search, update, showlist, index, reference

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', front),
    path('update/', update),
    path('list', showlist),
    path('index', index),
    path('search', search),
    path('reference', reference)
    # url(r'^idx/([0-9]+)', index_id),
]
