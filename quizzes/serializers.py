import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import models, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Attempt, Answer, Option, Question, QuestionTopic, Quiz, QuizAttachment, UserProfile

User = get_user_model()

CHOICE_TYPES = {Question.QuestionType.CHOICE_SINGLE, Question.QuestionType.CHOICE_MULTI, Question.QuestionType.TRUE_FALSE}


_media_url_validator = URLValidator(schemes=["http", "https"])


def normalize_media_url(value):
    if value is None:
        return None

    clean = str(value).strip()
    if not clean:
        return None

    # В редакторе квиза мы разрешаем не только внешние http(s)-ссылки,
    # но и локальные media-пути, которые отдаёт Django/Vite proxy.
    # DRF URLField такие относительные пути отвергает, поэтому валидируем вручную.
    if clean.startswith("/media/"):
        return clean
    if clean.startswith("media/"):
        return f"/{clean}"

    try:
        _media_url_validator(clean)
    except DjangoValidationError as exc:
        raise serializers.ValidationError("Введите ссылку вида https://... или локальный путь /media/...") from exc

    return clean


def media_file_url(file_field):
    if not file_field:
        return ""
    return file_field.url


def question_type_label(value: str) -> str:
    labels = {
        Question.QuestionType.CHOICE_SINGLE: "Один правильный вариант",
        Question.QuestionType.CHOICE_MULTI: "Несколько правильных вариантов",
        Question.QuestionType.TRUE_FALSE: "Верно/неверно",
        Question.QuestionType.INPUT_TEXT: "Краткий ответ",
        Question.QuestionType.INPUT_NUMBER: "Числовой ответ",
    }
    return labels.get(value, value)


def quiz_kind_label(value: str) -> str:
    labels = {
        Quiz.Kind.QUIZ: "Квиз",
        Quiz.Kind.TRIVIA: "Викторина",
    }
    return labels.get(value, value)


def grade_choice_answer(question: Question, selected_option_ids: set[int]) -> tuple[bool, float, set[int]]:
    correct_ids = set(question.options.filter(is_correct=True).values_list("id", flat=True))
    if question.type == Question.QuestionType.CHOICE_MULTI:
        # Частичный зачёт: доля правильно выбранных вариантов без штрафа ниже 0.
        if not correct_ids:
            return False, 0.0, correct_ids
        wrong_selected = selected_option_ids - correct_ids
        correct_selected = selected_option_ids & correct_ids
        ratio = max(0.0, (len(correct_selected) - len(wrong_selected)) / len(correct_ids))
        earned = round(float(question.points) * ratio, 2)
        return ratio == 1.0 and not wrong_selected, earned, correct_ids

    is_correct = bool(correct_ids) and selected_option_ids == correct_ids
    earned = float(question.points) if is_correct else 0.0
    return is_correct, earned, correct_ids


def grade_text_answer(question: Question, text_answer: str | None) -> tuple[bool, float]:
    actual = (text_answer or "").strip().lower()
    expected = (question.correct_text or "").strip().lower()
    is_correct = bool(expected) and actual == expected
    earned = float(question.points) if is_correct else 0.0
    return is_correct, earned


def grade_number_answer(question: Question, number_answer: float | None) -> tuple[bool, float]:
    if question.correct_number is None or number_answer is None:
        return False, 0.0
    tolerance = max(0.0, float(question.numeric_tolerance or 0.0))
    is_correct = abs(float(number_answer) - float(question.correct_number)) <= tolerance
    earned = float(question.points) if is_correct else 0.0
    return is_correct, earned


def calculate_answer_score_for_question(question, selected_options, text_answer=None, number_answer=None):
    if question.type in CHOICE_TYPES:
        selected_ids = set(selected_options.values_list("id", flat=True))
        _, earned, _ = grade_choice_answer(question, selected_ids)
        return earned

    if question.type == Question.QuestionType.INPUT_TEXT:
        _, earned = grade_text_answer(question, text_answer)
        return earned

    if question.type == Question.QuestionType.INPUT_NUMBER:
        _, earned = grade_number_answer(question, number_answer)
        return earned

    return 0.0


def is_attempt_expired(attempt: Attempt) -> bool:
    return bool(
        not attempt.is_submitted
        and attempt.deadline_at
        and attempt.deadline_at <= timezone.now()
    )


def finalize_expired_attempt(attempt: Attempt) -> Attempt:
    if not is_attempt_expired(attempt):
        return attempt

    with transaction.atomic():
        locked_attempt = (
            Attempt.objects
            .select_for_update()
            .select_related("quiz")
            .prefetch_related("quiz__questions__options", "answers__selected_options")
            .get(pk=attempt.pk)
        )

        if not is_attempt_expired(locked_attempt):
            return locked_attempt

        quiz_questions = list(locked_attempt.quiz.questions.all().prefetch_related("options"))
        answers_by_question_id = {
            answer.question_id: answer
            for answer in locked_attempt.answers.all().prefetch_related("selected_options")
        }
        total_score = 0.0

        for question in quiz_questions:
            answer = answers_by_question_id.get(question.id)
            if answer is None:
                answer = Answer.objects.create(attempt=locked_attempt, question=question)

            total_score += calculate_answer_score_for_question(
                question=question,
                selected_options=answer.selected_options.all(),
                text_answer=answer.text_answer,
                number_answer=answer.number_answer,
            )

        locked_attempt.score = total_score
        locked_attempt.is_submitted = True
        locked_attempt.finished_at = locked_attempt.deadline_at or timezone.now()
        locked_attempt.save(update_fields=["score", "is_submitted", "finished_at"])
        return locked_attempt


def finalize_expired_attempts(queryset) -> None:
    expired_ids = list(
        queryset
        .filter(is_submitted=False, deadline_at__isnull=False, deadline_at__lte=timezone.now())
        .values_list("id", flat=True)
    )

    if not expired_ids:
        return

    attempts = (
        Attempt.objects
        .filter(id__in=expired_ids)
        .select_related("quiz")
        .prefetch_related("quiz__questions__options", "answers__selected_options")
    )
    for attempt in attempts:
        finalize_expired_attempt(attempt)


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ["id", "text"]


class OptionWithCorrectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ["id", "text", "is_correct"]


class OptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ["text", "is_correct"]


class QuizAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttachment
        fields = ["id", "title", "filename", "url", "uploaded_at"]

    def get_url(self, obj):
        return media_file_url(obj.file)

    def get_filename(self, obj):
        return obj.filename


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    media_file_url = serializers.SerializerMethodField()
    type_label = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "explanation",
            "tags",
            "learning_goal",
            "type",
            "type_label",
            "points",
            "order",
            "media_kind",
            "media_file_url",
            "media_url",
            "options",
        ]

    def get_media_file_url(self, obj):
        return media_file_url(obj.media_file)

    def get_type_label(self, obj):
        return question_type_label(obj.type)


class QuizDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    attachments = QuizAttachmentSerializer(many=True, read_only=True)
    kind_label = serializers.SerializerMethodField()
    difficulty_label = serializers.SerializerMethodField()
    publish_status_label = serializers.SerializerMethodField()
    feedback_policy_label = serializers.SerializerMethodField()
    delivery_mode_label = serializers.SerializerMethodField()
    max_score = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "kind",
            "kind_label",
            "visibility",
            "difficulty",
            "difficulty_label",
            "publish_status",
            "publish_status_label",
            "access_code",
            "time_limit_minutes",
            "max_attempts",
            "shuffle_questions",
            "shuffle_options",
            "feedback_policy",
            "feedback_policy_label",
            "delivery_mode",
            "delivery_mode_label",
            "max_score",
            "questions",
            "attachments",
        ]

    def get_kind_label(self, obj):
        return quiz_kind_label(obj.kind)

    def get_difficulty_label(self, obj):
        labels = {
            Quiz.Difficulty.EASY: "Лёгкий",
            Quiz.Difficulty.MEDIUM: "Средний",
            Quiz.Difficulty.HARD: "Сложный",
        }
        return labels.get(obj.difficulty, obj.get_difficulty_display())

    def get_publish_status_label(self, obj):
        labels = {
            Quiz.PublishStatus.DRAFT: "Черновик",
            Quiz.PublishStatus.PUBLISHED: "Опубликован",
            Quiz.PublishStatus.ARCHIVED: "Архив",
        }
        return labels.get(obj.publish_status, obj.get_publish_status_display())

    def get_feedback_policy_label(self, obj):
        labels = {
            Quiz.FeedbackPolicy.AFTER_SUBMIT: "Показать результат с разбором",
            Quiz.FeedbackPolicy.SCORE_ONLY: "Показать только результат",
            Quiz.FeedbackPolicy.HIDDEN: "Скрыть результат",
        }
        return labels.get(obj.feedback_policy, obj.get_feedback_policy_display())

    def get_delivery_mode_label(self, obj):
        return "Live-прохождение" if obj.delivery_mode == Quiz.DeliveryMode.LIVE else "Самостоятельное прохождение"

    def get_max_score(self, obj):
        return float(sum(question.points for question in obj.questions.all()))


class AttemptCreateSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    deadline_at = serializers.DateTimeField(read_only=True)
    question_order = serializers.JSONField(read_only=True)
    option_order = serializers.JSONField(read_only=True)

    class Meta:
        model = Attempt
        fields = ["id", "quiz", "quiz_title", "deadline_at", "question_order", "option_order"]
        read_only_fields = ["id", "quiz_title", "deadline_at", "question_order", "option_order"]

    def validate_quiz(self, quiz):
        request = self.context["request"]
        if not quiz.is_accessible_for(request.user):
            raise serializers.ValidationError("Квиз недоступен для прохождения.")
        if quiz.publish_status != Quiz.PublishStatus.PUBLISHED:
            raise serializers.ValidationError("Квиз пока не опубликован.")
        if not quiz.questions.exists():
            raise serializers.ValidationError("В квизе пока нет вопросов.")

        finalize_expired_attempts(Attempt.objects.filter(user=request.user, quiz=quiz))

        if quiz.max_attempts > 0:
            used_attempts = Attempt.objects.filter(user=request.user, quiz=quiz, is_submitted=True).count()
            if used_attempts >= quiz.max_attempts:
                raise serializers.ValidationError("Лимит попыток по этому квизу исчерпан.")
        return quiz

    def create(self, validated_data):
        request = self.context["request"]
        quiz = validated_data["quiz"]

        active_attempt = (
            Attempt.objects
            .filter(user=request.user, quiz=quiz, is_submitted=False)
            .filter(models.Q(deadline_at__isnull=True) | models.Q(deadline_at__gt=timezone.now()))
            .order_by("-id")
            .first()
        )
        if active_attempt:
            return active_attempt

        questions = list(quiz.questions.all().prefetch_related("options"))
        question_ids = [question.id for question in sorted(questions, key=lambda item: item.order)]
        if quiz.shuffle_questions:
            random.shuffle(question_ids)

        option_order: dict[str, list[int]] = {}
        for question in questions:
            ids = list(question.options.values_list("id", flat=True))
            if quiz.shuffle_options:
                random.shuffle(ids)
            option_order[str(question.id)] = ids

        attempt = Attempt.objects.create(
            user=request.user,
            quiz=quiz,
            question_order=question_ids,
            option_order=option_order,
        )
        if quiz.time_limit_minutes:
            attempt.deadline_at = attempt.started_at + timedelta(minutes=quiz.time_limit_minutes)
            attempt.save(update_fields=["deadline_at"])
        return attempt


class AttemptListSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    quiz_kind = serializers.CharField(source="quiz.kind", read_only=True)
    quiz_kind_label = serializers.SerializerMethodField()
    max_score = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = ["id", "quiz", "quiz_title", "quiz_kind", "quiz_kind_label", "score", "max_score", "percent", "is_submitted", "started_at", "deadline_at", "finished_at"]

    def get_quiz_kind_label(self, obj):
        return "Викторина" if obj.quiz.kind == Quiz.Kind.TRIVIA else "Квиз"

    def get_max_score(self, obj):
        return float(sum(q.points for q in obj.quiz.questions.all()))

    def get_percent(self, obj):
        max_score = self.get_max_score(obj)
        if max_score <= 0:
            return 0
        return round((obj.score / max_score) * 100, 1)


class AttemptAnswerDetailSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_explanation = serializers.CharField(source="question.explanation", read_only=True)
    question_type = serializers.CharField(source="question.type", read_only=True)
    question_type_label = serializers.SerializerMethodField()
    correct_text = serializers.CharField(source="question.correct_text", read_only=True)
    correct_number = serializers.FloatField(source="question.correct_number", read_only=True)
    numeric_tolerance = serializers.FloatField(source="question.numeric_tolerance", read_only=True)
    points = serializers.FloatField(source="question.points", read_only=True)
    selected_options = serializers.SerializerMethodField()
    correct_options = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()
    is_correct = serializers.SerializerMethodField()
    earned_points = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = [
            "id",
            "question",
            "question_text",
            "question_explanation",
            "question_type",
            "question_type_label",
            "points",
            "options",
            "selected_options",
            "correct_options",
            "text_answer",
            "number_answer",
            "correct_text",
            "correct_number",
            "numeric_tolerance",
            "is_correct",
            "earned_points",
        ]

    def get_question_type_label(self, obj):
        return question_type_label(obj.question.type)

    def _selected_ids(self, obj) -> set[int]:
        return set(obj.selected_options.values_list("id", flat=True))

    def _grade(self, obj) -> tuple[bool, float, set[int]]:
        question = obj.question
        if question.type in CHOICE_TYPES:
            return grade_choice_answer(question, self._selected_ids(obj))
        if question.type == Question.QuestionType.INPUT_TEXT:
            is_correct, earned = grade_text_answer(question, obj.text_answer)
            return is_correct, earned, set()
        if question.type == Question.QuestionType.INPUT_NUMBER:
            is_correct, earned = grade_number_answer(question, obj.number_answer)
            return is_correct, earned, set()
        return False, 0.0, set()

    def get_selected_options(self, obj):
        return sorted(self._selected_ids(obj))

    def get_correct_options(self, obj):
        _, _, correct_ids = self._grade(obj)
        return sorted(correct_ids)

    def get_options(self, obj):
        return [
            {
                "id": option.id,
                "text": option.text,
                "is_correct": option.is_correct,
                "is_selected": option.id in self._selected_ids(obj),
            }
            for option in obj.question.options.all()
        ]

    def get_is_correct(self, obj):
        is_correct, _, _ = self._grade(obj)
        return is_correct

    def get_earned_points(self, obj):
        _, earned, _ = self._grade(obj)
        return earned


class AttemptDetailSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    quiz_description = serializers.CharField(source="quiz.description", read_only=True)
    max_score = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()
    remaining_seconds = serializers.SerializerMethodField()
    feedback_policy = serializers.CharField(source="quiz.feedback_policy", read_only=True)
    answers = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id",
            "quiz",
            "quiz_title",
            "quiz_description",
            "score",
            "max_score",
            "percent",
            "remaining_seconds",
            "feedback_policy",
            "is_submitted",
            "started_at",
            "deadline_at",
            "finished_at",
            "question_order",
            "option_order",
            "answers",
        ]

    def get_max_score(self, obj):
        return float(sum(question.points for question in obj.quiz.questions.all()))

    def get_percent(self, obj):
        max_score = self.get_max_score(obj)
        if max_score <= 0:
            return 0
        return round((obj.score / max_score) * 100, 1)

    def get_remaining_seconds(self, obj):
        if not obj.deadline_at or obj.is_submitted:
            return None
        return max(0, int((obj.deadline_at - timezone.now()).total_seconds()))

    def get_answers(self, obj):
        if obj.quiz.feedback_policy in [Quiz.FeedbackPolicy.HIDDEN, Quiz.FeedbackPolicy.SCORE_ONLY]:
            return []
        answers = list(obj.answers.all())
        if obj.question_order:
            order = {question_id: index for index, question_id in enumerate(obj.question_order)}
            answers.sort(key=lambda answer: order.get(answer.question_id, 10**9))
        return AttemptAnswerDetailSerializer(answers, many=True, context=self.context).data


class SubmitAnswerItemSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selected_options = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    text_answer = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    number_answer = serializers.FloatField(required=False, allow_null=True)


class AnswerSubmitSerializer(serializers.Serializer):
    answers = SubmitAnswerItemSerializer(many=True)


class QuizListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    kind_label = serializers.SerializerMethodField()
    difficulty_label = serializers.SerializerMethodField()
    publish_status_label = serializers.SerializerMethodField()
    delivery_mode_label = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    active_attempt_id = serializers.SerializerMethodField()
    active_attempt_deadline_at = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "kind",
            "kind_label",
            "status",
            "visibility",
            "difficulty",
            "difficulty_label",
            "publish_status",
            "publish_status_label",
            "access_code",
            "time_limit_minutes",
            "max_attempts",
            "delivery_mode",
            "delivery_mode_label",
            "question_count",
            "is_owner",
            "active_attempt_id",
            "active_attempt_deadline_at",
        ]

    def get_question_count(self, obj):
        return obj.questions.count()

    def get_kind_label(self, obj):
        return quiz_kind_label(obj.kind)

    def get_status(self, obj):
        visibility_label = "Публичный" if obj.visibility == Quiz.Visibility.PUBLIC else "Приватный"
        mode_label = "Live" if obj.delivery_mode == Quiz.DeliveryMode.LIVE else "Самостоятельный"
        if obj.publish_status == Quiz.PublishStatus.DRAFT:
            return f"Черновик · {visibility_label} · {mode_label}"
        if obj.publish_status == Quiz.PublishStatus.ARCHIVED:
            return f"Архив · {visibility_label} · {mode_label}"
        return f"{visibility_label} · {mode_label}"

    def get_difficulty_label(self, obj):
        labels = {Quiz.Difficulty.EASY: "Лёгкий", Quiz.Difficulty.MEDIUM: "Средний", Quiz.Difficulty.HARD: "Сложный"}
        return labels.get(obj.difficulty, obj.get_difficulty_display())

    def get_publish_status_label(self, obj):
        labels = {Quiz.PublishStatus.DRAFT: "Черновик", Quiz.PublishStatus.PUBLISHED: "Опубликован", Quiz.PublishStatus.ARCHIVED: "Архив"}
        return labels.get(obj.publish_status, obj.get_publish_status_display())

    def get_delivery_mode_label(self, obj):
        return "Live-прохождение" if obj.delivery_mode == Quiz.DeliveryMode.LIVE else "Самостоятельное прохождение"

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)

    def get_active_attempt(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        cache = self.context.get("_active_attempts_by_quiz_id")
        if cache is None:
            active_attempts = (
                Attempt.objects
                .filter(user=request.user, is_submitted=False)
                .filter(models.Q(deadline_at__isnull=True) | models.Q(deadline_at__gt=timezone.now()))
                .order_by("-id")
            )

            cache = {}
            for attempt in active_attempts:
                cache.setdefault(attempt.quiz_id, attempt)

            self.context["_active_attempts_by_quiz_id"] = cache

        return cache.get(obj.id)

    def get_active_attempt_id(self, obj):
        attempt = self.get_active_attempt(obj)
        return attempt.id if attempt else None

    def get_active_attempt_deadline_at(self, obj):
        attempt = self.get_active_attempt(obj)
        return attempt.deadline_at if attempt else None


class QuestionCreateSerializer(serializers.ModelSerializer):
    options = OptionCreateSerializer(many=True, required=False, default=list)
    media_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    topic = serializers.PrimaryKeyRelatedField(queryset=QuestionTopic.objects.all(), required=False, allow_null=True)
    media_file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "explanation",
            "tags",
            "learning_goal",
            "type",
            "points",
            "order",
            "options",
            "topic",
            "media_kind",
            "media_file_url",
            "media_url",
            "correct_text",
            "correct_number",
            "numeric_tolerance",
        ]
        read_only_fields = ["id", "media_file_url"]

    def get_media_file_url(self, obj):
        return media_file_url(obj.media_file)

    def validate_media_url(self, value):
        return normalize_media_url(value)

    def validate_options(self, options):
        return [option for option in options if option.get("text", "").strip()]

    def validate_topic(self, topic):
        return topic

    def validate(self, attrs):
        instance = self.instance
        question_type = attrs.get("type", getattr(instance, "type", Question.QuestionType.CHOICE_SINGLE))
        options = attrs.get("options")
        if options is None and instance:
            correct_count = instance.options.filter(is_correct=True).count()
            option_count = instance.options.count()
        else:
            options = options or []
            correct_count = sum(1 for option in options if option.get("is_correct"))
            option_count = len(options)

        if question_type in [Question.QuestionType.CHOICE_SINGLE, Question.QuestionType.TRUE_FALSE]:
            if option_count < 2:
                raise serializers.ValidationError("У вопроса должно быть минимум два варианта ответа.")
            if correct_count != 1:
                raise serializers.ValidationError("Для вопроса с одним выбором нужен ровно один правильный ответ.")
        elif question_type == Question.QuestionType.CHOICE_MULTI:
            if option_count < 2:
                raise serializers.ValidationError("У вопроса должно быть минимум два варианта ответа.")
            if correct_count < 1:
                raise serializers.ValidationError("Для вопроса с несколькими вариантами нужен хотя бы один правильный ответ.")
        elif question_type == Question.QuestionType.INPUT_TEXT:
            correct_text = attrs.get("correct_text", getattr(instance, "correct_text", ""))
            if not (correct_text or "").strip():
                raise serializers.ValidationError("Для краткого ответа укажи правильный текстовый ответ.")
        elif question_type == Question.QuestionType.INPUT_NUMBER:
            correct_number = attrs.get("correct_number", getattr(instance, "correct_number", None))
            if correct_number is None:
                raise serializers.ValidationError("Для числового ответа укажи правильное число.")
            if attrs.get("numeric_tolerance", getattr(instance, "numeric_tolerance", 0)) < 0:
                raise serializers.ValidationError("Допуск числового ответа не может быть отрицательным.")
        else:
            raise serializers.ValidationError("Неизвестный тип вопроса.")
        return attrs


class BankQuestionSerializer(QuestionCreateSerializer):
    options = OptionWithCorrectSerializer(many=True, required=False, default=list)
    topic_name = serializers.CharField(source="topic.name", read_only=True)
    type_label = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta(QuestionCreateSerializer.Meta):
        fields = [
            "id",
            "text",
            "explanation",
            "tags",
            "learning_goal",
            "type",
            "type_label",
            "points",
            "topic",
            "topic_name",
            "author_name",
            "is_owner",
            "options",
            "media_kind",
            "media_file_url",
            "media_url",
            "correct_text",
            "correct_number",
            "numeric_tolerance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "media_file_url", "created_at", "updated_at"]

    def get_type_label(self, obj):
        return question_type_label(obj.type)

    def get_author_name(self, obj):
        if not obj.author_id:
            return "Без автора"
        return obj.author.get_full_name() or obj.author.username

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)

    def create(self, validated_data):
        options_data = validated_data.pop("options", [])
        request = self.context["request"]
        question = Question.objects.create(author=request.user, quiz=None, order=0, **validated_data)
        self._replace_options(question, options_data)
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if options_data is not None:
            instance.options.all().delete()
            self._replace_options(instance, options_data)
        return instance

    def _replace_options(self, question, options_data):
        Option.objects.bulk_create(
            [
                Option(question=question, text=option_data["text"].strip(), is_correct=option_data.get("is_correct", False))
                for option_data in options_data
            ]
        )


class QuestionTopicSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = QuestionTopic
        fields = ["id", "name", "question_count", "created_at"]
        read_only_fields = ["id", "question_count", "created_at"]

    def get_question_count(self, obj):
        return obj.questions.filter(quiz__isnull=True).count()

    def validate_name(self, value):
        clean_name = value.strip()
        if not clean_name:
            raise serializers.ValidationError("Введите название темы.")
        return clean_name

    def create(self, validated_data):
        request = self.context["request"]
        topic, _ = QuestionTopic.objects.get_or_create(author=request.user, name=validated_data["name"])
        return topic


class QuizWriteSerializer(serializers.ModelSerializer):
    questions = QuestionCreateSerializer(many=True, write_only=True)
    allowed_logins = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "kind",
            "visibility",
            "difficulty",
            "publish_status",
            "access_code",
            "time_limit_minutes",
            "max_attempts",
            "shuffle_questions",
            "shuffle_options",
            "feedback_policy",
            "delivery_mode",
            "allowed_logins",
            "questions",
        ]
        read_only_fields = ["id", "access_code"]

    def validate_questions(self, questions):
        if not questions:
            raise serializers.ValidationError("Добавьте хотя бы один вопрос.")
        return questions

    def validate(self, attrs):
        visibility = attrs.get("visibility", getattr(self.instance, "visibility", Quiz.Visibility.PUBLIC))
        allowed_logins = attrs.get("allowed_logins") or []
        if visibility == Quiz.Visibility.PRIVATE and not allowed_logins:
            raise serializers.ValidationError("Для приватного квиза укажите хотя бы один логин пользователя.")
        time_limit_minutes = attrs.get("time_limit_minutes", getattr(self.instance, "time_limit_minutes", None))
        max_attempts = attrs.get("max_attempts", getattr(self.instance, "max_attempts", 0))
        if time_limit_minutes is not None and time_limit_minutes <= 0:
            raise serializers.ValidationError("Время на квиз должно быть больше 0 минут или пустым.")
        if max_attempts is not None and max_attempts < 0:
            raise serializers.ValidationError("Количество попыток не может быть отрицательным.")
        return attrs

    def _set_allowed_users(self, quiz, allowed_logins):
        if allowed_logins is not None:
            users = User.objects.filter(Q_username_or_email(allowed_logins)) if allowed_logins else User.objects.none()
            quiz.allowed_users.set(users)

    def _replace_questions(self, quiz, questions_data):
        quiz.questions.all().delete()
        for index, question_data in enumerate(questions_data):
            options_data = question_data.pop("options", [])
            question_data.pop("topic", None)
            question = Question.objects.create(
                quiz=quiz,
                author=quiz.author,
                order=question_data.get("order", index),
                **{key: value for key, value in question_data.items() if key != "order"},
            )
            Option.objects.bulk_create(
                [Option(question=question, text=option_data["text"].strip(), is_correct=option_data.get("is_correct", False)) for option_data in options_data]
            )

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        allowed_logins = validated_data.pop("allowed_logins", [])
        quiz = Quiz.objects.create(**validated_data)
        self._set_allowed_users(quiz, allowed_logins)
        self._replace_questions(quiz, questions_data)
        return quiz

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
        allowed_logins = validated_data.pop("allowed_logins", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if allowed_logins is not None:
            self._set_allowed_users(instance, allowed_logins)
        if questions_data is not None:
            self._replace_questions(instance, questions_data)
        return instance


class QuizEditQuestionSerializer(serializers.ModelSerializer):
    options = OptionWithCorrectSerializer(many=True, read_only=True)
    topic_name = serializers.CharField(source="topic.name", read_only=True)
    media_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "explanation",
            "tags",
            "learning_goal",
            "type",
            "points",
            "order",
            "topic",
            "topic_name",
            "options",
            "media_kind",
            "media_file_url",
            "media_url",
            "correct_text",
            "correct_number",
            "numeric_tolerance",
        ]

    def get_media_file_url(self, obj):
        return media_file_url(obj.media_file)


class QuizEditSerializer(serializers.ModelSerializer):
    questions = QuizEditQuestionSerializer(many=True, read_only=True)
    attachments = QuizAttachmentSerializer(many=True, read_only=True)
    allowed_logins = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "kind",
            "visibility",
            "difficulty",
            "publish_status",
            "access_code",
            "time_limit_minutes",
            "max_attempts",
            "shuffle_questions",
            "shuffle_options",
            "feedback_policy",
            "delivery_mode",
            "allowed_logins",
            "questions",
            "attachments",
        ]

    def get_allowed_logins(self, obj):
        return list(obj.allowed_users.values_list("username", flat=True))


QuizCreateSerializer = QuizWriteSerializer


def Q_username_or_email(values):
    from django.db.models import Q

    query = Q()
    for value in values:
        clean = value.strip()
        if clean:
            query |= Q(username__iexact=clean) | Q(email__iexact=clean)
    return query


class UserProfileSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    name = serializers.CharField(allow_blank=True)
    avatar_url = serializers.CharField(allow_blank=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=3)
    new_password_confirm = serializers.CharField(min_length=3)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError("Новые пароли не совпадают.")
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    login = serializers.CharField(max_length=254)

    def validate_login(self, value):
        clean = value.strip()
        if not clean:
            raise serializers.ValidationError("Введите email или логин.")
        return clean


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=3)
    new_password_confirm = serializers.CharField(min_length=3)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError("Новые пароли не совпадают.")
        return attrs
