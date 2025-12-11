from django.db import models
from django.contrib.auth import get_user_model

# Create your models here.

User = get_user_model()

class Quiz(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name="created_quizzes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title

class Question(models.Model):
    SINGLE = "single"
    MULTI = "multi"
    TRUE_FALSE = "tf"

    QUESTION_TYPES = {
        (SINGLE, "Single Choice"),
        (MULTI, "Multiple Choice"),
        (TRUE_FALSE, "True/False"),
    }

    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="questions",
    )

    text = models.TextField()

    type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPES,
        default=SINGLE,
    )

    points = models.FloatField(default=1.0)
    order = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"Q{self.order}: {self.text[:50]}"


class Option(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="options",
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"option({self.text[:30]})"


class Attempt(models.Model):
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="attempts",
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
    )

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0.0)
    is_submitted = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"Attempt({self.user} - {self.quiz})"


class Answer(models.Model):
    attempt = models.ForeignKey(
        Attempt,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    selected_options = models.ManyToManyField(Option, blank=True)

    def __str__(self) -> str:
        return f"Answer({self.attempt_id} - Q{self.question_id})"