import csv
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from quizzes.models import Answer, Attempt, Option, Question, QuestionTopic, Quiz

User = get_user_model()


CSV_ROWS = [
    {
        "text": "Сколько будет 10 / 2?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Математика",
        "tags": "арифметика, деление",
        "learning_goal": "Проверить деление простых чисел",
        "explanation": "10 / 2 = 5.",
        "correct_text": "",
        "correct_number": "",
        "numeric_tolerance": "",
        "media_url": "",
        "options": "4|5|6|10",
        "correct_options": "2",
    },
    {
        "text": "Какие технологии относятся к frontend-разработке?",
        "type": Question.QuestionType.CHOICE_MULTI,
        "points": 2,
        "topic": "Информатика",
        "tags": "frontend, web",
        "learning_goal": "Отличать frontend-технологии от backend-инструментов",
        "explanation": "HTML, CSS и React используются на стороне интерфейса пользователя.",
        "correct_text": "",
        "correct_number": "",
        "numeric_tolerance": "",
        "media_url": "",
        "options": "HTML|CSS|React|PostgreSQL",
        "correct_options": "1|2|3",
    },
    {
        "text": "CSS отвечает за внешний вид страницы.",
        "type": Question.QuestionType.TRUE_FALSE,
        "points": 1,
        "topic": "Информатика",
        "tags": "css, frontend",
        "learning_goal": "Понимать роль CSS",
        "explanation": "CSS задаёт стили: цвета, размеры, отступы и расположение элементов.",
        "correct_text": "",
        "correct_number": "",
        "numeric_tolerance": "",
        "media_url": "",
        "options": "Верно|Неверно",
        "correct_options": "1",
    },
    {
        "text": "Какой командой обычно запускают Docker Compose?",
        "type": Question.QuestionType.INPUT_TEXT,
        "points": 1,
        "topic": "Информатика",
        "tags": "docker, devops",
        "learning_goal": "Знать базовую команду запуска проекта",
        "explanation": "Команда docker compose up поднимает сервисы из docker-compose.yml.",
        "correct_text": "docker compose up",
        "correct_number": "",
        "numeric_tolerance": "",
        "media_url": "",
        "options": "",
        "correct_options": "",
    },
    {
        "text": "Сколько байт в одном килобайте в классическом двоичном понимании?",
        "type": Question.QuestionType.INPUT_NUMBER,
        "points": 1,
        "topic": "Информатика",
        "tags": "единицы измерения",
        "learning_goal": "Понимать единицы измерения информации",
        "explanation": "В двоичной системе 1 КБ часто считают как 1024 байта.",
        "correct_text": "",
        "correct_number": "1024",
        "numeric_tolerance": "0",
        "media_url": "",
        "options": "",
        "correct_options": "",
    },
]

MANUAL_QUESTIONS = [
    {
        "text": "Сколько будет 2 + 2?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Математика",
        "tags": "арифметика, базовый уровень",
        "learning_goal": "Проверить знание простого сложения",
        "explanation": "2 + 2 = 4, потому что к двум объектам добавляются ещё два.",
        "options": [("3", False), ("4", True), ("5", False), ("6", False)],
    },
    {
        "text": "Какой HTTP-метод обычно используют для получения данных?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Информатика",
        "tags": "web, http",
        "learning_goal": "Понимать базовые HTTP-методы",
        "explanation": "GET используют для запроса данных без изменения состояния ресурса.",
        "options": [("GET", True), ("POST", False), ("DELETE", False), ("PATCH", False)],
    },
    {
        "text": "Какие из перечисленных структур данных являются линейными?",
        "type": Question.QuestionType.CHOICE_MULTI,
        "points": 2,
        "topic": "Информатика",
        "tags": "структуры данных, алгоритмы",
        "learning_goal": "Отличать линейные структуры данных",
        "explanation": "Массив, стек и очередь имеют линейную организацию элементов, а граф описывает связи между вершинами.",
        "options": [("Массив", True), ("Стек", True), ("Очередь", True), ("Граф", False)],
    },
    {
        "text": "Какие события относятся к XX веку?",
        "type": Question.QuestionType.CHOICE_MULTI,
        "points": 2,
        "topic": "История",
        "tags": "история, хронология",
        "learning_goal": "Соотносить события с историческими периодами",
        "explanation": "Первая мировая, Вторая мировая и полёт Гагарина относятся к XX веку.",
        "options": [("Первая мировая война", True), ("Вторая мировая война", True), ("Отмена крепостного права в России", False), ("Полёт Гагарина", True)],
    },
    {
        "text": "HTML является языком программирования.",
        "type": Question.QuestionType.TRUE_FALSE,
        "points": 1,
        "topic": "Информатика",
        "tags": "html, frontend",
        "learning_goal": "Отличать язык разметки от языка программирования",
        "explanation": "HTML — это язык разметки, а не язык программирования.",
        "options": [("Верно", False), ("Неверно", True)],
    },
    {
        "text": "Число 17 является простым.",
        "type": Question.QuestionType.TRUE_FALSE,
        "points": 1,
        "topic": "Математика",
        "tags": "числа, простые числа",
        "learning_goal": "Проверить понимание простых чисел",
        "explanation": "17 делится только на 1 и на само себя.",
        "options": [("Верно", True), ("Неверно", False)],
    },
    {
        "text": "Напишите английский перевод слова «книга».",
        "type": Question.QuestionType.INPUT_TEXT,
        "points": 1,
        "topic": "Английский язык",
        "tags": "английский, словарный запас",
        "learning_goal": "Проверить базовую лексику",
        "explanation": "Слово «книга» переводится как book.",
        "correct_text": "book",
    },
    {
        "text": "Как называется основной файл зависимостей npm-проекта?",
        "type": Question.QuestionType.INPUT_TEXT,
        "points": 1,
        "topic": "Информатика",
        "tags": "npm, frontend",
        "learning_goal": "Знать базовую структуру JavaScript-проекта",
        "explanation": "package.json хранит зависимости, скрипты и метаданные npm-проекта.",
        "correct_text": "package.json",
    },
    {
        "text": "Чему равна площадь квадрата со стороной 5?",
        "type": Question.QuestionType.INPUT_NUMBER,
        "points": 2,
        "topic": "Математика",
        "tags": "геометрия, площадь",
        "learning_goal": "Вычислять площадь квадрата",
        "explanation": "Площадь квадрата равна стороне, умноженной на саму себя: 5 × 5 = 25.",
        "correct_number": 25,
        "numeric_tolerance": 0,
    },
    {
        "text": "Чему примерно равно число π с точностью до двух знаков?",
        "type": Question.QuestionType.INPUT_NUMBER,
        "points": 1,
        "topic": "Математика",
        "tags": "математика, константы",
        "learning_goal": "Знать приближённое значение числа π",
        "explanation": "Обычно π округляют до 3.14; небольшой допуск нужен из-за округления.",
        "correct_number": 3.14,
        "numeric_tolerance": 0.01,
    },
    {
        "text": "Что изображено на прикреплённой картинке?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Медиа-вопросы",
        "tags": "медиа, визуальное восприятие",
        "learning_goal": "Проверить работу медиа-вложений в вопросах",
        "explanation": "На изображении показана диаграмма, поэтому правильный ответ — «Диаграмма».",
        "media_kind": Question.MediaKind.FILE,
        "options": [("Таблица", False), ("Диаграмма", True), ("Текстовый документ", False), ("Аудиофайл", False)],
    },
    {
        "text": "Какой тег HTML используется для ссылки?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Информатика",
        "tags": "html, frontend",
        "learning_goal": "Знать базовые HTML-теги",
        "explanation": "Для гиперссылок используется тег a с атрибутом href.",
        "options": [("<a>", True), ("<p>", False), ("<div>", False), ("<img>", False)],
    },
    {
        "text": "В каком фильме звучит фраза «May the Force be with you»?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Кино",
        "tags": "кино, звездные войны, поп-культура",
        "learning_goal": "Развлекательная проверка знаний о популярных фильмах",
        "explanation": "Фраза «May the Force be with you» стала одной из самых известных цитат франшизы Star Wars.",
        "options": [("Звёздные войны", True), ("Матрица", False), ("Назад в будущее", False), ("Интерстеллар", False)],
    },
    {
        "text": "Какая группа выпустила альбом Abbey Road?",
        "type": Question.QuestionType.CHOICE_SINGLE,
        "points": 1,
        "topic": "Музыка",
        "tags": "музыка, рок, the beatles",
        "learning_goal": "Развлекательная проверка музыкальной эрудиции",
        "explanation": "Abbey Road — один из самых известных альбомов группы The Beatles.",
        "options": [("The Beatles", True), ("Queen", False), ("Pink Floyd", False), ("The Rolling Stones", False)],
    },
    {
        "text": "Какие из этих персонажей относятся к вселенной Marvel?",
        "type": Question.QuestionType.CHOICE_MULTI,
        "points": 2,
        "topic": "Кино",
        "tags": "кино, marvel, супергерои",
        "learning_goal": "Развлекательная проверка знаний о супергеройских фильмах",
        "explanation": "Железный человек, Человек-паук и Тор относятся к Marvel, а Бэтмен — к DC.",
        "options": [("Железный человек", True), ("Человек-паук", True), ("Тор", True), ("Бэтмен", False)],
    },
    {
        "text": "В шахматах ферзь ходит только по диагонали.",
        "type": Question.QuestionType.TRUE_FALSE,
        "points": 1,
        "topic": "Игры",
        "tags": "шахматы, игры, правила",
        "learning_goal": "Развлекательная проверка знания правил настольных игр",
        "explanation": "Ферзь ходит по вертикали, горизонтали и диагонали, поэтому утверждение неверно.",
        "options": [("Верно", False), ("Неверно", True)],
    },
    {
        "text": "Столица Австралии — Сидней.",
        "type": Question.QuestionType.TRUE_FALSE,
        "points": 1,
        "topic": "Общая эрудиция",
        "tags": "география, эрудиция, страны",
        "learning_goal": "Развлекательная проверка общей эрудиции",
        "explanation": "Столица Австралии — Канберра, а Сидней является крупнейшим городом страны.",
        "options": [("Верно", False), ("Неверно", True)],
    },
    {
        "text": "Как называется самый большой океан на Земле?",
        "type": Question.QuestionType.INPUT_TEXT,
        "points": 1,
        "topic": "Общая эрудиция",
        "tags": "география, океаны, эрудиция",
        "learning_goal": "Развлекательная проверка базовой географической эрудиции",
        "explanation": "Самый большой океан на Земле — Тихий океан.",
        "correct_text": "Тихий океан",
    },
    {
        "text": "Сколько игроков одной команды находится на футбольном поле в начале матча?",
        "type": Question.QuestionType.INPUT_NUMBER,
        "points": 1,
        "topic": "Общая эрудиция",
        "tags": "спорт, футбол, эрудиция",
        "learning_goal": "Развлекательная проверка знания спортивных правил",
        "explanation": "В начале футбольного матча на поле выходит 11 игроков одной команды.",
        "correct_number": 11,
        "numeric_tolerance": 0,
    },
]


class Command(BaseCommand):
    help = "Create demo users, question bank items, CSV sample and demo quizzes for QuizCraft."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="teacher123", help="Password for teacher account")
        parser.add_argument("--student-password", default="student123", help="Password for student accounts")

    def handle(self, *args, **options):
        with transaction.atomic():
            teacher = self._upsert_user(
                username="teacher",
                email="teacher@quizcraft.local",
                password=options["password"],
                first_name="Преподаватель",
                is_staff=True,
            )
            student1 = self._upsert_user(
                username="student1",
                email="student1@quizcraft.local",
                password=options["student_password"],
                first_name="Иван Студент",
            )
            student2 = self._upsert_user(
                username="student2",
                email="student2@quizcraft.local",
                password=options["student_password"],
                first_name="Мария Студент",
            )

            topics = {
                name: QuestionTopic.objects.get_or_create(author=teacher, name=name)[0]
                for name in ["Математика", "Информатика", "История", "Английский язык", "Медиа-вопросы", "Кино", "Музыка", "Общая эрудиция", "Игры"]
            }

            self._write_csv_sample()

            questions = {}
            for row in CSV_ROWS:
                questions[row["text"]] = self._upsert_question_from_csv_row(teacher, topics, row)
            for item in MANUAL_QUESTIONS:
                questions[item["text"]] = self._upsert_bank_question(teacher, topics, item)

            self._create_quizzes(teacher, student1, student2, questions)

        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
        self.stdout.write("Users:")
        self.stdout.write("  teacher / teacher123 / teacher@quizcraft.local")
        self.stdout.write("  student1 / student123 / student1@quizcraft.local")
        self.stdout.write("  student2 / student123 / student2@quizcraft.local")
        self.stdout.write(f"CSV sample: {settings.BASE_DIR / 'demo_questions_import.csv'}")

    def _upsert_user(self, username, email, password, first_name="", is_staff=False):
        user, _ = User.objects.get_or_create(username=username, defaults={"email": email})
        user.email = email
        user.first_name = first_name
        user.is_staff = is_staff or user.is_staff
        if is_staff:
            user.is_superuser = user.is_superuser
        user.set_password(password)
        user.save()
        return user

    def _write_csv_sample(self):
        path = Path(settings.BASE_DIR) / "demo_questions_import.csv"
        headers = [
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
        ]
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(CSV_ROWS)

    def _upsert_question_from_csv_row(self, author, topics, row):
        option_texts = [item.strip() for item in (row.get("options") or "").split("|") if item.strip()]
        correct_indexes = {int(item.strip()) for item in (row.get("correct_options") or "").split("|") if item.strip().isdigit()}
        return self._upsert_bank_question(
            author,
            topics,
            {
                "text": row["text"],
                "type": row["type"],
                "points": float(row["points"]),
                "topic": row["topic"],
                "tags": row["tags"],
                "learning_goal": row["learning_goal"],
                "explanation": row["explanation"],
                "correct_text": row.get("correct_text") or None,
                "correct_number": float(row["correct_number"]) if str(row.get("correct_number") or "").strip() else None,
                "numeric_tolerance": float(row["numeric_tolerance"]) if str(row.get("numeric_tolerance") or "").strip() else 0,
                "media_url": row.get("media_url") or None,
                "options": [(text, index in correct_indexes) for index, text in enumerate(option_texts, start=1)],
            },
        )

    def _upsert_bank_question(self, author, topics, data):
        topic = topics.get(data.get("topic"))
        question, _ = Question.objects.get_or_create(
            author=author,
            quiz=None,
            text=data["text"],
            defaults={"topic": topic},
        )
        question.topic = topic
        question.type = data.get("type", Question.QuestionType.CHOICE_SINGLE)
        question.points = float(data.get("points", 1))
        question.explanation = data.get("explanation", "")
        question.tags = data.get("tags", "")
        question.learning_goal = data.get("learning_goal", "")
        question.correct_text = data.get("correct_text") or None
        question.correct_number = data.get("correct_number")
        question.numeric_tolerance = float(data.get("numeric_tolerance", 0) or 0)
        question.media_kind = data.get("media_kind", Question.MediaKind.NONE)
        question.media_url = data.get("media_url") or None
        question.save()

        if data.get("media_kind") == Question.MediaKind.FILE and not question.media_file:
            svg = """<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"720\" height=\"360\" viewBox=\"0 0 720 360\"><rect width=\"720\" height=\"360\" fill=\"#eff6ff\"/><rect x=\"120\" y=\"190\" width=\"80\" height=\"90\" fill=\"#2563eb\"/><rect x=\"260\" y=\"130\" width=\"80\" height=\"150\" fill=\"#06b6d4\"/><rect x=\"400\" y=\"80\" width=\"80\" height=\"200\" fill=\"#22c55e\"/><text x=\"360\" y=\"320\" text-anchor=\"middle\" font-family=\"Arial\" font-size=\"28\" fill=\"#0f172a\">Demo diagram</text></svg>"""
            question.media_file.save("demo_diagram.svg", ContentFile(svg.encode("utf-8")), save=True)

        question.options.all().delete()
        Option.objects.bulk_create(
            [Option(question=question, text=text, is_correct=is_correct) for text, is_correct in data.get("options", [])]
        )
        return question

    def _copy_question_to_quiz(self, source, quiz, order):
        clone = Question.objects.create(
            quiz=quiz,
            author=quiz.author,
            topic=source.topic,
            text=source.text,
            explanation=source.explanation,
            tags=source.tags,
            learning_goal=source.learning_goal,
            type=source.type,
            points=source.points,
            order=order,
            media_kind=source.media_kind,
            media_url=source.media_url,
            correct_text=source.correct_text,
            correct_number=source.correct_number,
            numeric_tolerance=source.numeric_tolerance,
        )
        if source.media_file:
            clone.media_file = source.media_file
            clone.save(update_fields=["media_file"])
        Option.objects.bulk_create(
            [Option(question=clone, text=option.text, is_correct=option.is_correct) for option in source.options.all()]
        )

    def _upsert_quiz(self, author, title, question_texts, **fields):
        quiz, _ = Quiz.objects.get_or_create(author=author, title=title)
        for key, value in fields.items():
            setattr(quiz, key, value)
        quiz.save()
        quiz.questions.all().delete()
        return quiz

    def _fill_quiz(self, quiz, questions_by_text, question_texts):
        for order, question_text in enumerate(question_texts):
            self._copy_question_to_quiz(questions_by_text[question_text], quiz, order)
        return quiz

    def _create_quizzes(self, teacher, student1, student2, questions):
        basic = self._upsert_quiz(
            teacher,
            "Базовый тест по информатике",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Квиз для проверки базовых знаний по web, HTTP, Docker и структурам данных.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.MEDIUM,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=5,
            max_attempts=3,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(
            basic,
            questions,
            [
                "Какой HTTP-метод обычно используют для получения данных?",
                "Какие технологии относятся к frontend-разработке?",
                "HTML является языком программирования.",
                "Какой командой обычно запускают Docker Compose?",
                "Сколько байт в одном килобайте в классическом двоичном понимании?",
            ],
        )

        math = self._upsert_quiz(
            teacher,
            "Математика 5 класс: базовый уровень",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Академический квиз для проверки арифметики, площади квадрата и простых чисел.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.EASY,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=3,
            max_attempts=0,
            shuffle_questions=False,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(
            math,
            questions,
            [
                "Сколько будет 2 + 2?",
                "Чему равна площадь квадрата со стороной 5?",
                "Чему примерно равно число π с точностью до двух знаков?",
                "Число 17 является простым.",
            ],
        )

        private = self._upsert_quiz(
            teacher,
            "Закрытая домашняя работа",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Приватный учебный квиз, доступный только выбранным пользователям.",
            visibility=Quiz.Visibility.PRIVATE,
            difficulty=Quiz.Difficulty.MEDIUM,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=10,
            max_attempts=1,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.SCORE_ONLY,
        )
        private.allowed_users.set([student1, student2])
        self._fill_quiz(
            private,
            questions,
            [
                "Какие события относятся к XX веку?",
                "Напишите английский перевод слова «книга».",
                "CSS отвечает за внешний вид страницы.",
            ],
        )

        hidden = self._upsert_quiz(
            teacher,
            "Контрольная без показа результата",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Участник отправляет ответы, но результат скрыт преподавателем.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.HARD,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=5,
            max_attempts=1,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.HIDDEN,
        )
        self._fill_quiz(
            hidden,
            questions,
            [
                "Какие из перечисленных структур данных являются линейными?",
                "Как называется основной файл зависимостей npm-проекта?",
                "Чему примерно равно число π с точностью до двух знаков?",
            ],
        )

        draft = self._upsert_quiz(
            teacher,
            "Черновик будущего теста",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Этот академический квиз ещё нельзя проходить студентам.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.EASY,
            publish_status=Quiz.PublishStatus.DRAFT,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=None,
            max_attempts=0,
            shuffle_questions=False,
            shuffle_options=False,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(draft, questions, ["Сколько будет 2 + 2?"])

        archived = self._upsert_quiz(
            teacher,
            "Архивный тест прошлого семестра",
            [],
            kind=Quiz.Kind.QUIZ,
            description="Старый учебный тест, который больше не используется.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.MEDIUM,
            publish_status=Quiz.PublishStatus.ARCHIVED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=None,
            max_attempts=0,
            shuffle_questions=False,
            shuffle_options=False,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(archived, questions, ["Какой тег HTML используется для ссылки?"])

        live = self._upsert_quiz(
            teacher,
            "Live-викторина для аудитории",
            [],
            kind=Quiz.Kind.TRIVIA,
            description="Развлекательная live-викторина для аудитории: кино, музыка, игры и общая эрудиция.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.EASY,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.LIVE,
            time_limit_minutes=2,
            max_attempts=1,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(
            live,
            questions,
            [
                "В каком фильме звучит фраза «May the Force be with you»?",
                "Какая группа выпустила альбом Abbey Road?",
                "В шахматах ферзь ходит только по диагонали.",
            ],
        )

        movie_music = self._upsert_quiz(
            teacher,
            "Викторина: кино и музыка",
            [],
            kind=Quiz.Kind.TRIVIA,
            description="Развлекательная викторина с вопросами про фильмы, супергероев и рок-музыку.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.MEDIUM,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=4,
            max_attempts=0,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(
            movie_music,
            questions,
            [
                "В каком фильме звучит фраза «May the Force be with you»?",
                "Какая группа выпустила альбом Abbey Road?",
                "Какие из этих персонажей относятся к вселенной Marvel?",
            ],
        )

        erudition = self._upsert_quiz(
            teacher,
            "Викторина общей эрудиции",
            [],
            kind=Quiz.Kind.TRIVIA,
            description="Набор развлекательных вопросов по географии, спорту и настольным играм.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.EASY,
            publish_status=Quiz.PublishStatus.PUBLISHED,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=3,
            max_attempts=0,
            shuffle_questions=True,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(
            erudition,
            questions,
            [
                "Столица Австралии — Сидней.",
                "Как называется самый большой океан на Земле?",
                "Сколько игроков одной команды находится на футбольном поле в начале матча?",
                "В шахматах ферзь ходит только по диагонали.",
            ],
        )

        draft_trivia = self._upsert_quiz(
            teacher,
            "Черновик развлекательной викторины",
            [],
            kind=Quiz.Kind.TRIVIA,
            description="Черновик будущей развлекательной викторины, который нужен для проверки фильтра по статусу.",
            visibility=Quiz.Visibility.PUBLIC,
            difficulty=Quiz.Difficulty.MEDIUM,
            publish_status=Quiz.PublishStatus.DRAFT,
            delivery_mode=Quiz.DeliveryMode.SELF_PACED,
            time_limit_minutes=None,
            max_attempts=0,
            shuffle_questions=False,
            shuffle_options=True,
            feedback_policy=Quiz.FeedbackPolicy.AFTER_SUBMIT,
        )
        self._fill_quiz(draft_trivia, questions, ["В каком фильме звучит фраза «May the Force be with you»?"])

        self._create_demo_attempts(
            student1,
            student2,
            [basic, math, private, hidden, live, movie_music, erudition],
        )

    def _create_demo_attempts(self, student1, student2, quizzes):
        quizzes_by_title = {quiz.title: quiz for quiz in quizzes}
        Attempt.objects.filter(user__in=[student1, student2], quiz__in=quizzes).delete()

        self._create_submitted_attempt(
            student1,
            quizzes_by_title["Базовый тест по информатике"],
            [True, True, False, True, False],
        )
        self._create_submitted_attempt(
            student1,
            quizzes_by_title["Математика 5 класс: базовый уровень"],
            [True, True, True, True],
        )
        self._create_submitted_attempt(
            student1,
            quizzes_by_title["Live-викторина для аудитории"],
            [True, False, True],
        )

        self._create_submitted_attempt(
            student2,
            quizzes_by_title["Базовый тест по информатике"],
            [False, True, True, False, True],
        )
        self._create_submitted_attempt(
            student2,
            quizzes_by_title["Закрытая домашняя работа"],
            [True, True, False],
        )
        self._create_submitted_attempt(
            student2,
            quizzes_by_title["Викторина: кино и музыка"],
            [True, True, False],
        )
        self._create_submitted_attempt(
            student2,
            quizzes_by_title["Викторина общей эрудиции"],
            [False, True, True, False],
        )

    def _create_submitted_attempt(self, user, quiz, correctness_pattern):
        questions = list(quiz.questions.all().prefetch_related("options").order_by("order", "id"))
        question_order = [question.id for question in questions]
        option_order = {
            str(question.id): list(question.options.order_by("id").values_list("id", flat=True))
            for question in questions
        }

        attempt = Attempt.objects.create(
            user=user,
            quiz=quiz,
            question_order=question_order,
            option_order=option_order,
        )

        if quiz.time_limit_minutes:
            attempt.deadline_at = attempt.started_at + timedelta(minutes=quiz.time_limit_minutes)

        total_score = 0.0
        for index, question in enumerate(questions):
            should_be_correct = correctness_pattern[index % len(correctness_pattern)]
            answer = Answer.objects.create(attempt=attempt, question=question)
            total_score += self._fill_demo_answer(answer, question, should_be_correct)

        attempt.score = total_score
        attempt.is_submitted = True
        attempt.finished_at = timezone.now()
        attempt.save(update_fields=["deadline_at", "score", "is_submitted", "finished_at"])

    def _fill_demo_answer(self, answer, question, should_be_correct):
        if question.type in [
            Question.QuestionType.CHOICE_SINGLE,
            Question.QuestionType.CHOICE_MULTI,
            Question.QuestionType.TRUE_FALSE,
        ]:
            correct_options = list(question.options.filter(is_correct=True).order_by("id"))
            wrong_options = list(question.options.filter(is_correct=False).order_by("id"))
            selected_options = correct_options if should_be_correct else wrong_options[:1]
            answer.selected_options.set(selected_options)
            return float(question.points) if should_be_correct else 0.0

        if question.type == Question.QuestionType.INPUT_TEXT:
            answer.text_answer = question.correct_text if should_be_correct else "не знаю"
            answer.save(update_fields=["text_answer"])
            return float(question.points) if should_be_correct else 0.0

        if question.type == Question.QuestionType.INPUT_NUMBER:
            if should_be_correct:
                answer.number_answer = question.correct_number
            else:
                answer.number_answer = (question.correct_number or 0) + 100
            answer.save(update_fields=["number_answer"])
            return float(question.points) if should_be_correct else 0.0

        return 0.0
