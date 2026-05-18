import secrets
import string

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    avatar = models.FileField(upload_to="user_avatars/", blank=True, null=True)

    def __str__(self) -> str:
        return f"Profile({self.user})"


class QuestionTopic(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="question_topics")
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("author", "name")
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Quiz(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    class PublishStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    class FeedbackPolicy(models.TextChoices):
        AFTER_SUBMIT = "after_submit", "After submit"
        SCORE_ONLY = "score_only", "Score only"
        HIDDEN = "hidden", "Hidden"

    class DeliveryMode(models.TextChoices):
        SELF_PACED = "self_paced", "Self-paced"
        LIVE = "live", "Live"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="quizzes",
    )

    visibility = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )

    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
    )

    publish_status = models.CharField(
        max_length=12,
        choices=PublishStatus.choices,
        default=PublishStatus.PUBLISHED,
    )
    access_code = models.CharField(max_length=12, unique=True, blank=True, db_index=True)

    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    max_attempts = models.PositiveIntegerField(default=0, help_text="0 means unlimited")
    shuffle_questions = models.BooleanField(default=False)
    shuffle_options = models.BooleanField(default=False)
    feedback_policy = models.CharField(
        max_length=20,
        choices=FeedbackPolicy.choices,
        default=FeedbackPolicy.AFTER_SUBMIT,
    )
    delivery_mode = models.CharField(
        max_length=20,
        choices=DeliveryMode.choices,
        default=DeliveryMode.SELF_PACED,
    )

    allowed_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="allowed_quizzes",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title

    @staticmethod
    def generate_access_code() -> str:
        alphabet = string.ascii_uppercase + string.digits
        while True:
            code = "".join(secrets.choice(alphabet) for _ in range(6))
            if not Quiz.objects.filter(access_code=code).exists():
                return code

    def save(self, *args, **kwargs):
        if not self.access_code:
            self.access_code = self.generate_access_code()
        super().save(*args, **kwargs)

    def is_accessible_for(self, user):
        if self.publish_status != self.PublishStatus.PUBLISHED:
            if not user or not user.is_authenticated or user != self.author:
                return False
        if self.visibility == self.Visibility.PUBLIC:
            return True
        if not user or not user.is_authenticated:
            return False
        if user == self.author:
            return True
        return self.allowed_users.filter(pk=user.pk).exists()


class QuizAttachment(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="quiz_attachments/")
    title = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title or self.file.name

    @property
    def filename(self) -> str:
        return self.file.name.split("/")[-1]


class Question(models.Model):
    class QuestionType(models.TextChoices):
        CHOICE_SINGLE = "choice_single", "Single choice"
        CHOICE_MULTI = "choice_multi", "Multi choice"
        INPUT_TEXT = "input_text", "Text input"
        INPUT_NUMBER = "input_number", "Number input"
        TRUE_FALSE = "tf", "True/False choice"

    class MediaKind(models.TextChoices):
        NONE = "none", "None"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        FILE = "file", "File"

    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="questions",
        null=True,
        blank=True,
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="question_bank_items",
        null=True,
        blank=True,
    )

    topic = models.ForeignKey(
        QuestionTopic,
        on_delete=models.SET_NULL,
        related_name="questions",
        null=True,
        blank=True,
    )

    text = models.TextField()
    explanation = models.TextField(blank=True)
    tags = models.CharField(max_length=255, blank=True)
    learning_goal = models.CharField(max_length=255, blank=True)

    type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.CHOICE_SINGLE,
    )

    points = models.FloatField(default=1.0)
    order = models.PositiveIntegerField(default=0)

    media_kind = models.CharField(max_length=10, choices=MediaKind.choices, default=MediaKind.NONE)
    media_file = models.FileField(upload_to="question_media/", blank=True, null=True)
    media_url = models.URLField(blank=True, null=True)

    correct_text = models.CharField(max_length=255, blank=True, null=True)
    correct_number = models.FloatField(blank=True, null=True)
    numeric_tolerance = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        prefix = f"Q{self.order}" if self.quiz_id else "Bank question"
        return f"{prefix}: {self.text[:50]}"


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
    deadline_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0.0)
    is_submitted = models.BooleanField(default=False)
    question_order = models.JSONField(default=list, blank=True)
    option_order = models.JSONField(default=dict, blank=True)

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

    text_answer = models.CharField(max_length=255, blank=True, null=True)
    number_answer = models.FloatField(blank=True, null=True)

    def __str__(self) -> str:
        return f"Answer({self.attempt_id} - Q{self.question_id})"
