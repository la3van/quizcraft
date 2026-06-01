// src/api/types.ts

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type QuizKind = "quiz" | "trivia";
export type QuizVisibility = "public" | "private";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizPublishStatus = "draft" | "published" | "archived";
export type QuizFeedbackPolicy = "after_submit" | "score_only" | "hidden";
export type QuizDeliveryMode = "self_paced" | "live";
export type QuestionType = "choice_single" | "choice_multi" | "input_text" | "input_number" | "tf";
export type QuestionMediaKind = "none" | "video" | "audio" | "file";

export type QuizAttachment = {
  id: number;
  title: string;
  filename: string;
  url: string;
  uploaded_at: string;
};

export type QuizListItem = {
  id: number;
  title: string;
  description: string;
  kind: QuizKind;
  kind_label: string;
  status: string;
  visibility: QuizVisibility;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  publish_status: QuizPublishStatus;
  publish_status_label: string;
  access_code: string;
  time_limit_minutes: number | null;
  max_attempts: number;
  delivery_mode: QuizDeliveryMode;
  delivery_mode_label: string;
  question_count: number;
  is_owner: boolean;
  active_attempt_id: number | null;
  active_attempt_deadline_at: string | null;
};

export type QuizOption = {
  id: number;
  text: string;
};

export type QuizOptionWithCorrect = QuizOption & {
  is_correct: boolean;
};

export type QuizQuestion = {
  id: number;
  text: string;
  explanation: string;
  tags: string;
  learning_goal: string;
  type: QuestionType;
  type_label: string;
  points: number;
  order: number;
  media_kind: QuestionMediaKind;
  media_file_url: string;
  media_url: string | null;
  options: QuizOption[];
};

export type QuizDetail = {
  id: number;
  title: string;
  description: string;
  kind: QuizKind;
  kind_label: string;
  visibility: QuizVisibility;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  publish_status: QuizPublishStatus;
  publish_status_label: string;
  access_code: string;
  time_limit_minutes: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  feedback_policy: QuizFeedbackPolicy;
  feedback_policy_label: string;
  delivery_mode: QuizDeliveryMode;
  delivery_mode_label: string;
  max_score: number;
  questions: QuizQuestion[];
  attachments: QuizAttachment[];
};

export type QuizOptionCreate = {
  text: string;
  is_correct: boolean;
};

export type QuizQuestionCreate = {
  text: string;
  explanation: string;
  tags: string;
  learning_goal: string;
  type: QuestionType;
  points: number;
  order: number;
  options: QuizOptionCreate[];
  media_kind: QuestionMediaKind;
  media_url: string | null;
  correct_text: string | null;
  correct_number: number | null;
  numeric_tolerance: number;
};

export type QuizCreateRequest = {
  title: string;
  description: string;
  kind: QuizKind;
  visibility: QuizVisibility;
  difficulty: QuizDifficulty;
  publish_status: QuizPublishStatus;
  time_limit_minutes: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  feedback_policy: QuizFeedbackPolicy;
  delivery_mode: QuizDeliveryMode;
  allowed_logins?: string[];
  questions: QuizQuestionCreate[];
};

export type QuizCreateResponse = {
  id: number;
  title: string;
  description: string;
  kind: QuizKind;
  visibility: QuizVisibility;
  difficulty: QuizDifficulty;
  publish_status: QuizPublishStatus;
  delivery_mode: QuizDeliveryMode;
  access_code: string;
};

export type QuizEditData = {
  id: number;
  title: string;
  description: string;
  kind: QuizKind;
  visibility: QuizVisibility;
  difficulty: QuizDifficulty;
  publish_status: QuizPublishStatus;
  access_code: string;
  time_limit_minutes: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  feedback_policy: QuizFeedbackPolicy;
  delivery_mode: QuizDeliveryMode;
  allowed_logins: string[];
  questions: Array<{
    id: number;
    text: string;
    explanation: string;
    tags: string;
    learning_goal: string;
    type: QuestionType;
    points: number;
    order: number;
    topic: number | null;
    topic_name: string | null;
    options: QuizOptionWithCorrect[];
    media_kind: QuestionMediaKind;
    media_file_url: string;
    media_url: string | null;
    correct_text: string | null;
    correct_number: number | null;
    numeric_tolerance: number;
  }>;
  attachments: QuizAttachment[];
};

export type AttemptCreateResponse = {
  id: number;
  quiz: number;
  quiz_title: string;
  deadline_at: string | null;
  question_order: number[];
  option_order: Record<string, number[]>;
};

export type AttemptItem = {
  id: number;
  quiz: number;
  quiz_title: string;
  quiz_kind: QuizKind;
  quiz_kind_label: string;
  score: number;
  max_score: number;
  percent: number;
  is_submitted: boolean;
  started_at: string;
  deadline_at: string | null;
  finished_at: string | null;
};

export type SubmitAnswer = {
  question: number;
  selected_options?: number[];
  text_answer?: string | null;
  number_answer?: number | null;
};

export type SubmitRequest = {
  answers: SubmitAnswer[];
};

export type AttemptAnswerOption = {
  id: number;
  text: string;
  is_correct: boolean;
  is_selected: boolean;
};

export type AttemptAnswerDetail = {
  id: number;
  question: number;
  question_text: string;
  question_explanation: string;
  question_type: QuestionType;
  question_type_label: string;
  points: number;
  options: AttemptAnswerOption[];
  selected_options: number[];
  correct_options: number[];
  text_answer: string | null;
  number_answer: number | null;
  correct_text: string | null;
  correct_number: number | null;
  numeric_tolerance: number;
  is_correct: boolean;
  earned_points: number;
};

export type AttemptDetail = {
  id: number;
  quiz: number;
  quiz_title: string;
  quiz_description: string;
  score: number;
  max_score: number;
  percent: number;
  remaining_seconds: number | null;
  feedback_policy: QuizFeedbackPolicy;
  is_submitted: boolean;
  started_at: string;
  deadline_at: string | null;
  finished_at: string | null;
  question_order: number[];
  option_order: Record<string, number[]>;
  answers: AttemptAnswerDetail[];
};

export type SubmitResponse = AttemptDetail;

export type QuestionTopic = {
  id: number;
  name: string;
  question_count: number;
  created_at: string;
};

export type BankQuestion = {
  id: number;
  text: string;
  explanation: string;
  tags: string;
  learning_goal: string;
  type: QuestionType;
  type_label: string;
  points: number;
  topic: number | null;
  topic_name: string | null;
  author_name: string;
  is_owner: boolean;
  options: QuizOptionWithCorrect[];
  media_kind: QuestionMediaKind;
  media_file_url: string;
  media_url: string | null;
  correct_text: string | null;
  correct_number: number | null;
  numeric_tolerance: number;
  created_at: string;
  updated_at: string;
};

export type BankQuestionPayload = {
  text: string;
  explanation: string;
  tags: string;
  learning_goal: string;
  type: QuestionType;
  points: number;
  topic: number | null;
  options: QuizOptionCreate[];
  media_kind: QuestionMediaKind;
  media_url: string | null;
  correct_text: string | null;
  correct_number: number | null;
  numeric_tolerance: number;
};

export type QuizAnalyticsAttempt = {
  id: number;
  user: string;
  username: string;
  score: number;
  max_score: number;
  percent: number;
  finished_at: string | null;
};

export type QuizAnalyticsQuestion = {
  question_id: number;
  text: string;
  type: QuestionType;
  type_label: string;
  learning_goal: string;
  tags: string;
  answers_count: number;
  correct_count: number;
  accuracy_percent: number;
  average_points: number;
  max_points: number;
};

export type QuizAnalytics = {
  quiz: { id: number; title: string; kind: QuizKind; kind_label: string; max_score: number };
  summary: {
    attempts_count: number;
    average_percent: number;
    average_score: number;
    min_percent: number;
    max_percent: number;
  };
  attempts: QuizAnalyticsAttempt[];
  questions: QuizAnalyticsQuestion[];
};

export type DailyProfileActivity = {
  date: string;
  created: number;
  passed: number;
};

export type MonthlyProfileActivity = {
  month: string;
  quizzes: number;
  questions: number;
  passed: number;
};

export type YearlyProfileActivity = {
  year: number;
  quizzes: number;
  questions: number;
  passed: number;
  avg_quizzes_per_month: number;
  avg_questions_per_month: number;
  avg_passed_per_month: number;
  quiz_percent: number;
  question_percent: number;
  passed_percent: number;
};

export type ProfileStats = {
  created_quizzes: number;
  created_questions: number;
  completed_attempts: number;
  total_attempts: number;
  average_result: number;
  activity: DailyProfileActivity[];
  monthly_activity: MonthlyProfileActivity[];
  monthly_averages_last_12: {
    quizzes: number;
    questions: number;
    passed: number;
  };
  yearly_activity: YearlyProfileActivity[];
};
