from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Attempt, Option, Question, Quiz

User = get_user_model()


class AttemptFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="teacher", email="teacher@example.com", password="pass123")
        self.other_user = User.objects.create_user(username="student", email="student@example.com", password="pass123")
        self.quiz = Quiz.objects.create(title="Math quiz", description="Test", author=self.user)
        self.q1 = Question.objects.create(
            quiz=self.quiz,
            author=self.user,
            text="2 + 2?",
            type=Question.QuestionType.CHOICE_SINGLE,
            points=1,
            order=0,
        )
        self.q1_bad = Option.objects.create(question=self.q1, text="3", is_correct=False)
        self.q1_good = Option.objects.create(question=self.q1, text="4", is_correct=True)
        self.q2 = Question.objects.create(
            quiz=self.quiz,
            author=self.user,
            text="Prime numbers",
            type=Question.QuestionType.CHOICE_MULTI,
            points=2,
            order=1,
        )
        self.q2_good_1 = Option.objects.create(question=self.q2, text="2", is_correct=True)
        self.q2_good_2 = Option.objects.create(question=self.q2, text="3", is_correct=True)
        self.q2_bad = Option.objects.create(question=self.q2, text="4", is_correct=False)

    def test_user_can_create_submit_and_read_attempt_result(self):
        self.client.force_login(self.other_user)

        create_response = self.client.post(reverse("attempt-list-create"), {"quiz": self.quiz.id}, content_type="application/json")
        self.assertEqual(create_response.status_code, 201)
        attempt_id = create_response.json()["id"]

        submit_response = self.client.post(
            reverse("attempt-submit", args=[attempt_id]),
            {
                "answers": [
                    {"question": self.q1.id, "selected_options": [self.q1_good.id]},
                    {"question": self.q2.id, "selected_options": [self.q2_good_1.id, self.q2_good_2.id]},
                ]
            },
            content_type="application/json",
        )
        self.assertEqual(submit_response.status_code, 200)
        data = submit_response.json()
        self.assertEqual(data["score"], 3.0)
        self.assertEqual(data["max_score"], 3.0)
        self.assertEqual(data["percent"], 100.0)
        self.assertEqual(len(data["answers"]), 2)
        self.assertTrue(all(answer["is_correct"] for answer in data["answers"]))

        detail_response = self.client.get(reverse("attempt-detail", args=[attempt_id]))
        self.assertEqual(detail_response.status_code, 200)
        detail = detail_response.json()
        self.assertTrue(detail["is_submitted"])
        self.assertEqual(detail["score"], 3.0)


    def test_access_code_endpoint_opens_published_quiz(self):
        self.client.force_login(self.other_user)
        response = self.client.get(reverse("quiz-by-code", args=[self.quiz.access_code]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.quiz.id)

    def test_max_attempts_blocks_extra_submitted_attempts(self):
        self.quiz.max_attempts = 1
        self.quiz.save(update_fields=["max_attempts"])
        Attempt.objects.create(user=self.other_user, quiz=self.quiz, is_submitted=True, score=0)
        self.client.force_login(self.other_user)

        response = self.client.post(reverse("attempt-list-create"), {"quiz": self.quiz.id}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Лимит попыток", str(response.json()))

    def test_attempt_creation_stores_timer_and_orders(self):
        self.quiz.time_limit_minutes = 5
        self.quiz.shuffle_questions = True
        self.quiz.shuffle_options = True
        self.quiz.save(update_fields=["time_limit_minutes", "shuffle_questions", "shuffle_options"])
        self.client.force_login(self.other_user)

        response = self.client.post(reverse("attempt-list-create"), {"quiz": self.quiz.id}, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIsNotNone(data["deadline_at"])
        self.assertCountEqual(data["question_order"], [self.q1.id, self.q2.id])
        self.assertIn(str(self.q1.id), data["option_order"])

    def test_attempt_rejects_question_from_another_quiz(self):
        self.client.force_login(self.other_user)
        another_quiz = Quiz.objects.create(title="Other", author=self.user)
        foreign_question = Question.objects.create(
            quiz=another_quiz,
            author=self.user,
            text="Foreign",
            type=Question.QuestionType.CHOICE_SINGLE,
            points=1,
        )

        create_response = self.client.post(reverse("attempt-list-create"), {"quiz": self.quiz.id}, content_type="application/json")
        attempt_id = create_response.json()["id"]

        submit_response = self.client.post(
            reverse("attempt-submit", args=[attempt_id]),
            {"answers": [{"question": foreign_question.id, "selected_options": []}]},
            content_type="application/json",
        )
        self.assertEqual(submit_response.status_code, 400)
