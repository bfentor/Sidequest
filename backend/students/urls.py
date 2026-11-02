from django.urls import path

from .views import StudentStatusView, StudentVerifyView, UniversityListView

urlpatterns = [
    path("universities/", UniversityListView.as_view(), name="university-list"),
    path("me/student/", StudentStatusView.as_view(), name="student-status"),
    path("me/student/verify/", StudentVerifyView.as_view(), name="student-verify"),
]
