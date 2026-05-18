# Generated for QuizCraft patch 4.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("quizzes", "0002_remove_quiz_created_by_answer_number_answer_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("avatar", models.FileField(blank=True, null=True, upload_to="user_avatars/")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="QuestionTopic",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="question_topics", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("author", "name")},
            },
        ),
        migrations.AddField(
            model_name="quiz",
            name="difficulty",
            field=models.CharField(choices=[("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard")], default="medium", max_length=10),
        ),
        migrations.AddField(
            model_name="quiz",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name="question",
            name="quiz",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="quizzes.quiz"),
        ),
        migrations.AddField(
            model_name="question",
            name="author",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="question_bank_items", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="question",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="question",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="question",
            name="topic",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="questions", to="quizzes.questiontopic"),
        ),
        migrations.CreateModel(
            name="QuizAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="quiz_attachments/")),
                ("title", models.CharField(blank=True, max_length=255)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="quizzes.quiz")),
            ],
        ),
    ]
