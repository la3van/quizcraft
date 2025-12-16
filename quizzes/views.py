from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Quiz, Attempt, Answer, Question, Option
from .serializers import (
    QuizDetailSerializer,
    AttemptCreateSerializer,
    AnswerSubmitSerializer,
)


class QuizDetailView(generics.RetrieveAPIView):
    """
    GET /api/quizzes/<id>/

    Возвращает полный квиз с вопросами и вариантами.
    """

    queryset = Quiz.objects.all()
    serializer_class = QuizDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttemptCreateView(generics.CreateAPIView):
    """
    POST /api/attempts/

    Тело запроса: { "quiz": <id квиза> }
    user будет взят из request.user (см. AttemptCreateSerializer.create).
    """

    serializer_class = AttemptCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttemptSubmitView(APIView):
    """
    POST /api/attempts/<id>/submit/

    Тело запроса:
    {
      "answers": [
        {"question": <id>, "selected_options": [<id>, ...]},
        ...
      ]
    }

    Логика:
    - проверяем, что попытка принадлежит текущему пользователю;
    - создаём Answer для каждого вопроса;
    - связываем выбранные варианты через ManyToMany;
    - сравниваем выбранные варианты с правильными;
    - считаем суммарный score и сохраняем его в Attempt.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        # 1. Находим попытку, убеждаемся, что это попытка текущего пользователя
        try:
            attempt = Attempt.objects.get(pk=pk, user=request.user)
        except Attempt.DoesNotExist:
            return Response({"detail": "Attempt not found"}, status=404)

        # 2. Не даём отправить попытку второй раз
        if attempt.is_submitted:
            return Response({"detail": "Already submitted"}, status=400)

        # 3. Валидируем тело запроса
        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        total_score = 0.0

        # 4. Обрабатываем каждый ответ
        for ans_data in serializer.validated_data["answers"]:
            q_id = ans_data["question"]
            selected_ids = ans_data.get("selected_options", [])

            # ищем вопрос именно в этом квизе,
            # чтобы нельзя было отправить ответы на чужие вопросы
            try:
                question = Question.objects.get(pk=q_id, quiz=attempt.quiz)
            except Question.DoesNotExist:
                return Response(
                    {"detail": f"Question {q_id} not found in this quiz"},
                    status=400,
                )

            # достаём опции, принадлежащие этому вопросу
            selected_options = Option.objects.filter(
                pk__in=selected_ids,
                question=question,
            )

            # создаём Answer
            answer = Answer.objects.create(
                attempt=attempt,
                question=question,
            )
            answer.selected_options.set(selected_options)

            # 5. Сравниваем выбор с правильными вариантами
            correct_ids = set(
                question.options.filter(is_correct=True).values_list("id", flat=True)
            )
            selected_set = set(selected_options.values_list("id", flat=True))

            # Простая логика: балл начисляется только если выбраны
            # ровно все правильные варианты и никаких лишних
            if selected_set == correct_ids:
                total_score += question.points

        # 6. Сохраняем результат в Attempt
        attempt.score = total_score
        attempt.is_submitted = True
        attempt.finished_at = timezone.now()
        attempt.save()

        # 7. Возвращаем итоговый балл
        return Response({"score": total_score})
