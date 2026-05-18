from django.contrib import admin

from .models import Answer, Attempt, Option, Question, QuestionTopic, Quiz, QuizAttachment, UserProfile


class OptionInline(admin.TabularInline):
    model = Option
    extra = 2


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("text", "explanation", "tags", "learning_goal", "type", "points", "order", "topic", "media_kind", "media_file", "media_url", "correct_text", "correct_number", "numeric_tolerance")


class QuizAttachmentInline(admin.TabularInline):
    model = QuizAttachment
    extra = 1
    fields = ("title", "file", "uploaded_at")
    readonly_fields = ("uploaded_at",)


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "author", "publish_status", "visibility", "difficulty", "delivery_mode", "access_code", "created_at")
    list_filter = ("publish_status", "visibility", "difficulty", "delivery_mode", "feedback_policy", "created_at")
    search_fields = ("title", "description", "author__username", "author__email")
    inlines = [QuestionInline, QuizAttachmentInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "quiz", "author", "topic", "type", "points", "order", "tags", "learning_goal")
    list_filter = ("type", "topic", "media_kind")
    search_fields = ("text", "explanation", "author__username", "author__email")
    inlines = [OptionInline]


@admin.register(QuestionTopic)
class QuestionTopicAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "author", "created_at")
    search_fields = ("name", "author__username", "author__email")


@admin.register(QuizAttachment)
class QuizAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "quiz", "title", "file", "uploaded_at")
    search_fields = ("title", "quiz__title")


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ("id", "text", "question", "is_correct")
    list_filter = ("question", "is_correct")
    search_fields = ("text",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "avatar")
    search_fields = ("user__username", "user__email")


admin.site.register(Attempt)
admin.site.register(Answer)
