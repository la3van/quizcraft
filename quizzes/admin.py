from django.contrib import admin
from .models import Quiz, Question, Option, Attempt, Answer


class OptionInline(admin.TabularInline):
    model = Option
    extra = 2


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "created_by", "created_at")
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "quiz", "type", "points", "order")
    inlines = [OptionInline]


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ("id", "text", "question", "is_correct")
    list_filter = ("question", "is_correct")
    search_fields = ("text",)


admin.site.register(Attempt)
admin.site.register(Answer)
