# Generated manually for QuizCraft patch 6.

from django.db import migrations, models


def fill_access_codes(apps, schema_editor):
    Quiz = apps.get_model("quizzes", "Quiz")
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    used = set(Quiz.objects.exclude(access_code="").values_list("access_code", flat=True))

    def make_code(seed):
        number = seed + 100000
        chars = []
        while number:
            number, idx = divmod(number, len(alphabet))
            chars.append(alphabet[idx])
        code = ("".join(reversed(chars)) or "A00000")[-6:].rjust(6, "A")
        suffix = 0
        candidate = code
        while candidate in used:
            suffix += 1
            candidate = f"{code[:4]}{suffix:02d}"[-6:]
        used.add(candidate)
        return candidate

    for quiz in Quiz.objects.filter(access_code=""):
        quiz.access_code = make_code(quiz.pk)
        quiz.save(update_fields=["access_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("quizzes", "0003_profile_topics_bank_questions_quiz_files"),
    ]

    operations = [
        migrations.AddField(
            model_name="quiz",
            name="publish_status",
            field=models.CharField(
                choices=[("draft", "Draft"), ("published", "Published"), ("archived", "Archived")],
                default="published",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="quiz",
            name="access_code",
            field=models.CharField(blank=True, db_index=True, max_length=12, unique=True),
        ),
        migrations.AddField(
            model_name="quiz",
            name="time_limit_minutes",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quiz",
            name="max_attempts",
            field=models.PositiveIntegerField(default=0, help_text="0 means unlimited"),
        ),
        migrations.AddField(
            model_name="quiz",
            name="shuffle_questions",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="quiz",
            name="shuffle_options",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="quiz",
            name="feedback_policy",
            field=models.CharField(
                choices=[("after_submit", "After submit"), ("score_only", "Score only"), ("hidden", "Hidden")],
                default="after_submit",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="attempt",
            name="deadline_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="attempt",
            name="question_order",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="attempt",
            name="option_order",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(fill_access_codes, migrations.RunPython.noop),
    ]
