from django.urls import path

from .views import QuizDetailView, AttemptCreateView, AttemptSubmitView

urlpatterns = [
    path("quizzes/<int:pk>/", QuizDetailView.as_view(), name="quiz-detail"),
    path("attempts/", AttemptCreateView.as_view(), name="attempt-create"),
    path("attempts/<int:pk>/submit/", AttemptSubmitView.as_view(), name="attempt-submit"),
]
