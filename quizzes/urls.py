from django.urls import path

from .views import QuizDetailView, AttemptCreateView, AttemptListCreateView, AttemptSubmitView

urlpatterns = [
    path("quizzes/<int:pk>/", QuizDetailView.as_view(), name="quiz-detail"),
    path("attempts/", AttemptListCreateView.as_view(), name="attempt-create"),
    path("attempts/<int:pk>/submit/", AttemptSubmitView.as_view(), name="attempt-submit"),
]
