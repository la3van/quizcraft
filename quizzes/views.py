import csv
import io
from collections import OrderedDict, defaultdict
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login as auth_login, logout as auth_logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Answer, Attempt, Option, Question, QuestionTopic, Quiz, QuizAttachment, UserProfile
from .permissions import IsQuizAccessible
from .serializers import (
    AnswerSubmitSerializer,
    AttemptCreateSerializer,
    AttemptDetailSerializer,
    AttemptListSerializer,
    BankQuestionSerializer,
    ChangePasswordSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    QuestionTopicSerializer,
    QuizAttachmentSerializer,
    QuizCreateSerializer,
    QuizDetailSerializer,
    QuizEditSerializer,
    QuizListSerializer,
    grade_choice_answer,
    grade_number_answer,
    grade_text_answer,
)

User = get_user_model()


class QuizReadOrAuthorWritePermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.is_accessible_for(request.user)
        return request.user.is_authenticated and obj.author_id == request.user.id


class IsBankQuestionOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.is_authenticated and obj.author_id == request.user.id


class IsTopicOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.is_authenticated and obj.author_id == request.user.id


class QuizListCreateView(ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "public")
        owner = self.request.query_params.get("owner")
        search = (self.request.query_params.get("search") or "").strip()

        qs = Quiz.objects.select_related("author").prefetch_related("questions").all()

        if scope == "mine" or owner == "me":
            if not user.is_authenticated:
                return Quiz.objects.none()
            qs = qs.filter(author=user)
        elif scope == "private":
            if not user.is_authenticated:
                return Quiz.objects.none()
            qs = qs.filter(publish_status=Quiz.PublishStatus.PUBLISHED, visibility=Quiz.Visibility.PRIVATE).filter(Q(author=user) | Q(allowed_users=user)).distinct()
        elif scope == "available":
            if user.is_authenticated:
                qs = qs.filter(publish_status=Quiz.PublishStatus.PUBLISHED).filter(Q(visibility=Quiz.Visibility.PUBLIC) | Q(author=user) | Q(allowed_users=user)).distinct()
            else:
                qs = qs.filter(publish_status=Quiz.PublishStatus.PUBLISHED, visibility=Quiz.Visibility.PUBLIC)
        else:
            qs = qs.filter(publish_status=Quiz.PublishStatus.PUBLISHED, visibility=Quiz.Visibility.PUBLIC)

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return QuizCreateSerializer
        return QuizListSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class QuizDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Quiz.objects.all().prefetch_related("questions__options", "attachments")
    permission_classes = [QuizReadOrAuthorWritePermission]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return QuizCreateSerializer
        return QuizDetailSerializer


class QuizByCodeView(generics.RetrieveAPIView):
    serializer_class = QuizDetailSerializer
    permission_classes = [IsQuizAccessible]
    lookup_field = "access_code"
    lookup_url_kwarg = "code"

    def get_queryset(self):
        return Quiz.objects.filter(publish_status=Quiz.PublishStatus.PUBLISHED).prefetch_related("questions__options", "attachments")


class QuizEditDataView(generics.RetrieveAPIView):
    serializer_class = QuizEditSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Quiz.objects.filter(author=self.request.user).prefetch_related("questions__options", "attachments", "allowed_users")


class QuizAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_quiz(self, request, pk):
        try:
            return Quiz.objects.get(pk=pk, author=request.user)
        except Quiz.DoesNotExist:
            return None

    def get(self, request, pk: int):
        quiz = self.get_quiz(request, pk)
        if not quiz:
            return Response({"detail": "Квиз не найден или недоступен."}, status=404)
        serializer = QuizAttachmentSerializer(quiz.attachments.all(), many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, pk: int):
        quiz = self.get_quiz(request, pk)
        if not quiz:
            return Response({"detail": "Квиз не найден или недоступен."}, status=404)

        files = request.FILES.getlist("files")
        if not files and request.FILES.get("file"):
            files = [request.FILES["file"]]

        if not files:
            return Response({"detail": "Выберите хотя бы один файл."}, status=400)

        created = []
        for uploaded_file in files:
            created.append(QuizAttachment.objects.create(quiz=quiz, file=uploaded_file, title=uploaded_file.name))

        serializer = QuizAttachmentSerializer(created, many=True, context={"request": request})
        return Response(serializer.data, status=201)


class QuizAttachmentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk: int, attachment_id: int):
        try:
            attachment = QuizAttachment.objects.get(pk=attachment_id, quiz_id=pk, quiz__author=request.user)
        except QuizAttachment.DoesNotExist:
            return Response({"detail": "Файл не найден."}, status=404)
        attachment.delete()
        return Response(status=204)


class AttemptCreateView(generics.CreateAPIView):
    serializer_class = AttemptCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttemptListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Attempt.objects.filter(user=self.request.user).select_related("quiz").prefetch_related("quiz__questions").order_by("-id")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return AttemptListSerializer
        return AttemptCreateSerializer


class AttemptDetailView(generics.RetrieveAPIView):
    serializer_class = AttemptDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Attempt.objects.filter(user=self.request.user)
            .select_related("quiz")
            .prefetch_related("quiz__questions", "answers__question__options", "answers__selected_options")
        )


class AttemptSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def calculate_answer_score(question, selected_options, text_answer=None, number_answer=None):
        if question.type in [Question.QuestionType.CHOICE_SINGLE, Question.QuestionType.CHOICE_MULTI, Question.QuestionType.TRUE_FALSE]:
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

    def post(self, request, pk: int):
        try:
            attempt = (
                Attempt.objects.select_related("quiz")
                .prefetch_related("quiz__questions__options")
                .get(pk=pk, user=request.user)
            )
        except Attempt.DoesNotExist:
            return Response({"detail": "Попытка не найдена."}, status=404)

        if attempt.is_submitted:
            return Response({"detail": "Эта попытка уже завершена."}, status=400)

        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        answers_by_question_id = {
            item["question"]: item
            for item in serializer.validated_data["answers"]
        }

        quiz_questions = list(attempt.quiz.questions.all().prefetch_related("options"))
        quiz_question_ids = {question.id for question in quiz_questions}
        unknown_question_ids = set(answers_by_question_id) - quiz_question_ids
        if unknown_question_ids:
            return Response(
                {"detail": f"Вопросы не принадлежат этому квизу: {sorted(unknown_question_ids)}."},
                status=400,
            )

        total_score = 0.0

        with transaction.atomic():
            attempt.answers.all().delete()

            for question in quiz_questions:
                ans_data = answers_by_question_id.get(question.id, {})
                selected_ids = ans_data.get("selected_options", []) or []

                answer = Answer.objects.create(
                    attempt=attempt,
                    question=question,
                    text_answer=(ans_data.get("text_answer") or "").strip() or None,
                    number_answer=ans_data.get("number_answer"),
                )

                selected_options = Option.objects.filter(pk__in=selected_ids, question=question)
                answer.selected_options.set(selected_options)

                total_score += self.calculate_answer_score(
                    question=question,
                    selected_options=selected_options,
                    text_answer=answer.text_answer,
                    number_answer=answer.number_answer,
                )

            attempt.score = total_score
            attempt.is_submitted = True
            attempt.finished_at = timezone.now()
            attempt.save(update_fields=["score", "is_submitted", "finished_at"])

        attempt = (
            Attempt.objects.select_related("quiz")
            .prefetch_related("quiz__questions", "answers__question__options", "answers__selected_options")
            .get(pk=attempt.pk)
        )
        return Response(AttemptDetailSerializer(attempt, context={"request": request}).data)


class QuestionTopicListCreateView(generics.ListCreateAPIView):
    serializer_class = QuestionTopicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return QuestionTopic.objects.filter(author=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class QuestionTopicDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuestionTopicSerializer
    permission_classes = [IsAuthenticated, IsTopicOwner]

    def get_queryset(self):
        return QuestionTopic.objects.filter(author=self.request.user)


class BankQuestionListCreateView(generics.ListCreateAPIView):
    serializer_class = BankQuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Question.objects.filter(author=self.request.user, quiz__isnull=True).select_related("topic").prefetch_related("options")
        topic_id = self.request.query_params.get("topic")
        search = (self.request.query_params.get("search") or "").strip()
        if topic_id:
            qs = qs.filter(topic_id=topic_id)
        if search:
            qs = qs.filter(text__icontains=search)
        return qs.order_by("-created_at", "-id")


class BankQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BankQuestionSerializer
    permission_classes = [IsAuthenticated, IsBankQuestionOwner]

    def get_queryset(self):
        return Question.objects.filter(author=self.request.user, quiz__isnull=True).select_related("topic").prefetch_related("options")



class BankQuestionMediaUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk: int):
        try:
            question = Question.objects.get(pk=pk, author=request.user, quiz__isnull=True)
        except Question.DoesNotExist:
            return Response({"detail": "Вопрос не найден."}, status=404)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "Выберите файл."}, status=400)

        question.media_file = uploaded_file
        question.media_kind = request.data.get("media_kind") or Question.MediaKind.FILE
        question.save(update_fields=["media_file", "media_kind", "updated_at"])
        return Response(BankQuestionSerializer(question, context={"request": request}).data)


class BankQuestionExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="quizcraft_questions.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow([
            "text",
            "type",
            "points",
            "topic",
            "tags",
            "learning_goal",
            "explanation",
            "correct_text",
            "correct_number",
            "numeric_tolerance",
            "media_url",
            "options",
            "correct_options",
        ])
        qs = Question.objects.filter(author=request.user, quiz__isnull=True).select_related("topic").prefetch_related("options")
        for question in qs.order_by("-created_at", "-id"):
            options = list(question.options.all())
            writer.writerow([
                question.text,
                question.type,
                question.points,
                question.topic.name if question.topic else "",
                question.tags,
                question.learning_goal,
                question.explanation,
                question.correct_text or "",
                "" if question.correct_number is None else question.correct_number,
                question.numeric_tolerance,
                question.media_url or "",
                "|".join(option.text for option in options),
                "|".join(str(index + 1) for index, option in enumerate(options) if option.is_correct),
            ])
        return response


class BankQuestionImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "Выберите CSV-файл."}, status=400)

        try:
            content = uploaded_file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"detail": "CSV должен быть в UTF-8."}, status=400)

        reader = csv.DictReader(io.StringIO(content))
        created = 0
        errors = []

        with transaction.atomic():
            for row_index, row in enumerate(reader, start=2):
                text = (row.get("text") or "").strip()
                if not text:
                    errors.append(f"Строка {row_index}: пустой текст вопроса")
                    continue

                q_type = (row.get("type") or Question.QuestionType.CHOICE_SINGLE).strip() or Question.QuestionType.CHOICE_SINGLE
                points = float(row.get("points") or 1)
                topic_name = (row.get("topic") or "").strip()
                topic = None
                if topic_name:
                    topic, _ = QuestionTopic.objects.get_or_create(author=request.user, name=topic_name)

                question = Question.objects.create(
                    author=request.user,
                    quiz=None,
                    text=text,
                    type=q_type,
                    points=points,
                    topic=topic,
                    tags=(row.get("tags") or "").strip(),
                    learning_goal=(row.get("learning_goal") or "").strip(),
                    explanation=(row.get("explanation") or "").strip(),
                    correct_text=(row.get("correct_text") or "").strip() or None,
                    correct_number=float(row["correct_number"]) if (row.get("correct_number") or "").strip() else None,
                    numeric_tolerance=float(row.get("numeric_tolerance") or 0),
                    media_url=(row.get("media_url") or "").strip() or None,
                    media_kind=Question.MediaKind.FILE if (row.get("media_url") or "").strip() else Question.MediaKind.NONE,
                )

                option_texts = [item.strip() for item in (row.get("options") or "").split("|") if item.strip()]
                correct_indexes = set()
                for raw in (row.get("correct_options") or "").split("|"):
                    raw = raw.strip()
                    if raw.isdigit():
                        correct_indexes.add(int(raw))
                for index, option_text in enumerate(option_texts, start=1):
                    Option.objects.create(question=question, text=option_text, is_correct=index in correct_indexes)
                created += 1

        return Response({"created": created, "errors": errors})


class QuizAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_quiz(self, request, pk):
        try:
            return Quiz.objects.prefetch_related("questions__options").get(pk=pk, author=request.user)
        except Quiz.DoesNotExist:
            return None

    def get(self, request, pk: int):
        quiz = self.get_quiz(request, pk)
        if not quiz:
            return Response({"detail": "Квиз не найден или недоступен."}, status=404)

        attempts = Attempt.objects.filter(quiz=quiz, is_submitted=True).select_related("user").prefetch_related(
            "answers__question", "answers__selected_options", "quiz__questions"
        )
        max_score = float(sum(question.points for question in quiz.questions.all()))
        attempts_payload = []
        percents = []
        for attempt in attempts.order_by("-finished_at", "-id"):
            percent = round((attempt.score / max_score) * 100, 1) if max_score > 0 else 0
            percents.append(percent)
            attempts_payload.append({
                "id": attempt.id,
                "user": attempt.user.get_full_name() or attempt.user.username,
                "username": attempt.user.username,
                "score": attempt.score,
                "max_score": max_score,
                "percent": percent,
                "finished_at": attempt.finished_at,
            })

        question_stats = []
        for question in quiz.questions.all().order_by("order", "id"):
            answers = Answer.objects.filter(attempt__quiz=quiz, attempt__is_submitted=True, question=question).prefetch_related("selected_options")
            total = answers.count()
            earned_total = 0.0
            correct = 0
            for answer in answers:
                selected = answer.selected_options.all()
                earned = AttemptSubmitView.calculate_answer_score(question, selected, answer.text_answer, answer.number_answer)
                earned_total += earned
                if question.points and earned >= float(question.points):
                    correct += 1
            question_stats.append({
                "question_id": question.id,
                "text": question.text,
                "type": question.type,
                "type_label": question.get_type_display(),
                "learning_goal": question.learning_goal,
                "tags": question.tags,
                "answers_count": total,
                "correct_count": correct,
                "accuracy_percent": round((correct / total) * 100, 1) if total else 0,
                "average_points": round(earned_total / total, 2) if total else 0,
                "max_points": question.points,
            })

        return Response({
            "quiz": {"id": quiz.id, "title": quiz.title, "max_score": max_score},
            "summary": {
                "attempts_count": attempts.count(),
                "average_percent": round(sum(percents) / len(percents), 1) if percents else 0,
                "average_score": round(attempts.aggregate(value=Avg("score"))["value"] or 0, 2),
                "min_percent": min(percents) if percents else 0,
                "max_percent": max(percents) if percents else 0,
            },
            "attempts": attempts_payload,
            "questions": question_stats,
        })


class QuizAnalyticsExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        try:
            quiz = Quiz.objects.prefetch_related("questions").get(pk=pk, author=request.user)
        except Quiz.DoesNotExist:
            return Response({"detail": "Квиз не найден или недоступен."}, status=404)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="quiz_{quiz.id}_results.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(["attempt_id", "username", "user", "score", "max_score", "percent", "finished_at"])
        max_score = float(sum(question.points for question in quiz.questions.all()))
        attempts = Attempt.objects.filter(quiz=quiz, is_submitted=True).select_related("user").order_by("-finished_at", "-id")
        for attempt in attempts:
            percent = round((attempt.score / max_score) * 100, 1) if max_score > 0 else 0
            writer.writerow([
                attempt.id,
                attempt.user.username,
                attempt.user.get_full_name() or attempt.user.username,
                attempt.score,
                max_score,
                percent,
                attempt.finished_at.isoformat() if attempt.finished_at else "",
            ])
        return response

def serialize_user(user, request=None):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    display_name = user.get_full_name().strip() or user.first_name.strip() or user.username
    avatar_url = ""
    if profile.avatar:
        avatar_url = profile.avatar.url
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": display_name,
        "avatar_url": avatar_url,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie
def me_view(request):
    get_token(request)
    return Response(serialize_user(request.user, request))


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        login_value = (request.data.get("login") or request.data.get("email") or request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        if not login_value or not password:
            return Response({"detail": "Введите email/логин и пароль."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = User.objects.filter(Q(username__iexact=login_value) | Q(email__iexact=login_value)).first()
        username = user_obj.username if user_obj else login_value

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Неверный логин или пароль."}, status=status.HTTP_400_BAD_REQUEST)

        auth_login(request, user)
        get_token(request)
        return Response(serialize_user(user, request))


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""

        if not name:
            return Response({"detail": "Введите имя."}, status=status.HTTP_400_BAD_REQUEST)
        if not email:
            return Response({"detail": "Введите email."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 3:
            return Response({"detail": "Пароль должен быть не короче 3 символов."}, status=status.HTTP_400_BAD_REQUEST)

        if not username:
            username = email.split("@")[0]

        base_username = username
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1

        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Пользователь с таким email уже существует."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name,
        )
        UserProfile.objects.get_or_create(user=user)
        auth_login(request, user)
        get_token(request)
        return Response(serialize_user(user, request), status=status.HTTP_201_CREATED)


class PasswordResetRequestView(APIView):
    """Generate a one-time password reset link and send it by email.

    In local Docker/dev mode Django uses console email backend, so the email
    text is printed to backend logs. In DEBUG mode the link is also returned in
    the response to make course-project demos easier.
    """

    permission_classes = [AllowAny]

    GENERIC_DETAIL = "Если пользователь найден, ссылка для сброса пароля отправлена."

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login_value = serializer.validated_data["login"]

        user = User.objects.filter(Q(username__iexact=login_value) | Q(email__iexact=login_value), is_active=True).first()
        response_data = {"detail": self.GENERIC_DETAIL}

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
            reset_link = f"{frontend_base_url}/reset-password/{uid}/{token}"

            subject = "Сброс пароля QuizCraft"
            message = (
                "Здравствуйте!\n\n"
                "Для сброса пароля в QuizCraft перейдите по ссылке:\n"
                f"{reset_link}\n\n"
                "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо."
            )

            if user.email:
                send_mail(
                    subject,
                    message,
                    getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@quizcraft.local"),
                    [user.email],
                    fail_silently=True,
                )

            if settings.DEBUG:
                print("\n[QuizCraft password reset link]")
                print(f"User: {user.username} <{user.email}>")
                print(reset_link)
                print("[/QuizCraft password reset link]\n")
                response_data["debug_reset_link"] = reset_link

        return Response(response_data)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=uid, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Ссылка для сброса пароля недействительна или устарела."}, status=400)

        token = serializer.validated_data["token"]
        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Ссылка для сброса пароля недействительна или устарела."}, status=400)

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Пароль успешно изменён. Теперь можно войти с новым паролем."})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        auth_logout(request)
        return Response({"detail": "Logged out."})


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(serialize_user(request.user, request))

    def patch(self, request):
        user = request.user
        name = request.data.get("name")
        username = request.data.get("username")
        email = request.data.get("email")

        if name is not None:
            user.first_name = str(name).strip()
        if username is not None:
            clean_username = str(username).strip()
            if not clean_username:
                return Response({"detail": "Логин не может быть пустым."}, status=400)
            if User.objects.exclude(pk=user.pk).filter(username__iexact=clean_username).exists():
                return Response({"detail": "Такой логин уже занят."}, status=400)
            user.username = clean_username
        if email is not None:
            clean_email = str(email).strip().lower()
            if not clean_email:
                return Response({"detail": "Email не может быть пустым."}, status=400)
            if User.objects.exclude(pk=user.pk).filter(email__iexact=clean_email).exists():
                return Response({"detail": "Такой email уже занят."}, status=400)
            user.email = clean_email
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if request.FILES.get("avatar"):
            profile.avatar = request.FILES["avatar"]
            profile.save()

        return Response(serialize_user(user, request))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response({"detail": "Текущий пароль введён неверно."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        auth_login(request, user)
        return Response({"detail": "Пароль изменён."})


class ProfileStatsView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def month_key(value: date) -> str:
        return f"{value.year:04d}-{value.month:02d}"

    @staticmethod
    def add_months(value: date, months: int) -> date:
        month_index = value.year * 12 + value.month - 1 + months
        year = month_index // 12
        month = month_index % 12 + 1
        return date(year, month, 1)

    @staticmethod
    def yearly_item(year: int, quizzes: int, questions: int, passed: int, months_count: int) -> dict:
        total = quizzes + questions + passed
        safe_months_count = max(1, months_count)
        return {
            "year": year,
            "quizzes": quizzes,
            "questions": questions,
            "passed": passed,
            "avg_quizzes_per_month": round(quizzes / safe_months_count, 2),
            "avg_questions_per_month": round(questions / safe_months_count, 2),
            "avg_passed_per_month": round(passed / safe_months_count, 2),
            "quiz_percent": round((quizzes / total) * 100, 1) if total else 0,
            "question_percent": round((questions / total) * 100, 1) if total else 0,
            "passed_percent": round((passed / total) * 100, 1) if total else 0,
        }

    def get(self, request):
        user = request.user
        created_quizzes = Quiz.objects.filter(author=user)
        bank_questions = Question.objects.filter(author=user, quiz__isnull=True)
        attempts = Attempt.objects.filter(user=user)
        submitted_attempts = attempts.filter(is_submitted=True).select_related("quiz").prefetch_related("quiz__questions")

        percents = []
        for attempt in submitted_attempts:
            max_score = float(sum(question.points for question in attempt.quiz.questions.all()))
            if max_score > 0:
                percents.append((attempt.score / max_score) * 100)

        average_result = round(sum(percents) / len(percents), 1) if percents else 0

        today = timezone.now().date()
        start_day = today - timedelta(days=13)
        activity = OrderedDict()
        for offset in range(14):
            day = start_day + timedelta(days=offset)
            activity[day.isoformat()] = {"date": day.isoformat(), "created": 0, "passed": 0}

        for quiz in created_quizzes.filter(created_at__date__gte=start_day):
            key = quiz.created_at.date().isoformat()
            if key in activity:
                activity[key]["created"] += 1

        for attempt in submitted_attempts.filter(finished_at__date__gte=start_day):
            if attempt.finished_at:
                key = attempt.finished_at.date().isoformat()
                if key in activity:
                    activity[key]["passed"] += 1

        current_month = date(today.year, today.month, 1)
        first_month = self.add_months(current_month, -11)
        monthly_map = OrderedDict()
        for offset in range(12):
            month = self.add_months(first_month, offset)
            monthly_map[self.month_key(month)] = {"month": self.month_key(month), "quizzes": 0, "questions": 0, "passed": 0}

        for quiz in created_quizzes.filter(created_at__date__gte=first_month):
            key = self.month_key(quiz.created_at.date())
            if key in monthly_map:
                monthly_map[key]["quizzes"] += 1

        for question in bank_questions.filter(created_at__date__gte=first_month):
            key = self.month_key(question.created_at.date())
            if key in monthly_map:
                monthly_map[key]["questions"] += 1

        for attempt in submitted_attempts.filter(finished_at__date__gte=first_month):
            if attempt.finished_at:
                key = self.month_key(attempt.finished_at.date())
                if key in monthly_map:
                    monthly_map[key]["passed"] += 1

        monthly_activity = list(monthly_map.values())
        yearly_map = defaultdict(lambda: {"quizzes": 0, "questions": 0, "passed": 0})
        first_activity_year = today.year

        for quiz in created_quizzes:
            year = quiz.created_at.year
            first_activity_year = min(first_activity_year, year)
            yearly_map[year]["quizzes"] += 1

        for question in bank_questions:
            year = question.created_at.year
            first_activity_year = min(first_activity_year, year)
            yearly_map[year]["questions"] += 1

        for attempt in submitted_attempts:
            if attempt.finished_at:
                year = attempt.finished_at.year
                first_activity_year = min(first_activity_year, year)
                yearly_map[year]["passed"] += 1

        yearly_activity = []
        for year in range(first_activity_year, today.year + 1):
            item = yearly_map[year]
            if year == today.year:
                months_count = today.month
            else:
                months_count = 12
            yearly_activity.append(
                self.yearly_item(
                    year=year,
                    quizzes=item["quizzes"],
                    questions=item["questions"],
                    passed=item["passed"],
                    months_count=months_count,
                )
            )

        total_quizzes_last_12 = sum(item["quizzes"] for item in monthly_activity)
        total_questions_last_12 = sum(item["questions"] for item in monthly_activity)
        total_passed_last_12 = sum(item["passed"] for item in monthly_activity)

        return Response(
            {
                "created_quizzes": created_quizzes.count(),
                "created_questions": bank_questions.count(),
                "completed_attempts": submitted_attempts.count(),
                "total_attempts": attempts.count(),
                "average_result": average_result,
                "activity": list(activity.values()),
                "monthly_activity": monthly_activity,
                "monthly_averages_last_12": {
                    "quizzes": round(total_quizzes_last_12 / 12, 2),
                    "questions": round(total_questions_last_12 / 12, 2),
                    "passed": round(total_passed_last_12 / 12, 2),
                },
                "yearly_activity": yearly_activity,
            }
        )
