export function pluralizeQuestions(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return "вопросов";
  }

  if (mod10 === 1) {
    return "вопрос";
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return "вопроса";
  }

  return "вопросов";
}
