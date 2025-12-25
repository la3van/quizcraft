from rest_framework import serializers

from .models import Quiz, Question, Option, Attempt, Answer


class OptionSerializer(serializers.ModelSerializer):
    """
    Сериализатор для варианта ответа.

    Нужен, чтобы выдавать студенту список опций у вопроса.
    Специально НЕ включаем is_correct, чтобы не спойлерить правильные ответы.
    """

    class Meta:
        model = Option
        fields = ["id", "text"]


class QuestionSerializer(serializers.ModelSerializer):
    """
    Вопрос квиза, вместе с вариантами ответа.

    Используется только для чтения (read-only), поэтому options read_only.
    """

    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "text", "type", "points", "order", "options"]



class QuizDetailSerializer(serializers.ModelSerializer):
    """
    Детальное представление квиза для студента:
    — название, описание;
    — список вопросов с вариантами.
    """

    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = ["id", "title", "description", "questions"]


class AttemptCreateSerializer(serializers.ModelSerializer):
    """
    Сериализатор для создания попытки.

    В запросе ожидаем только поле quiz (id квиза).
    user НЕ приходит с клиента — берём его из request.user в create().
    """

    class Meta:
        model = Attempt
        fields = ["id", "quiz"]  # id появится в ответе, quiz придёт в запросе
        read_only_fields = ["id"]

    def create(self, validated_data):
        """
        Переопределяем create, чтобы подставить user из запроса.

        self.context['request'] DRF передаёт автоматически,
        мы попросим view передать контекст.
        """
        request = self.context["request"]
        user = request.user
        return Attempt.objects.create(user=user, **validated_data)


class AttemptListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attempt
        fields = ["id", "quiz", "score", "is_submitted"]


class AnswerSubmitSerializer(serializers.Serializer):
    """
    Сериализатор "ручного" формата для отправки ответов.

    Ожидаемый JSON:
    {
      "answers": [
        {"question": <id вопроса>, "selected_options": [<id опции>, ...]},
        ...
      ]
    }
    """

    answers = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )
