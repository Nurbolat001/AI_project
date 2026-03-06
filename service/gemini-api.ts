// service/gemini-api.ts
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

// Ключ API из переменных окружения (должен быть в .env)
const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCEwGGwZfnzWJTmXSOhQ8Du-NsZ9mRaAZE';

// Инициализация Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

// Выбираем модель (gemini-1.5-pro или gemini-pro, смотря что доступно)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite', // или 'gemini-pro', если 1.5 не доступен
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

/**
 * Генерирует текст документа на основе промпта с помощью Gemini API.
 * @param prompt - текстовый запрос с описанием документа
 * @returns сгенерированный текст документа
 */
export async function generateDocument(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('GOOGLE_API_KEY не задан. Проверьте .env файл.');
  }

  try {
    // Запускаем генерацию
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Пустой ответ от Gemini');
    }

    return text;
  } catch (error) {
    console.error('Ошибка при генерации документа:', error);
    // Пробрасываем ошибку дальше, чтобы обработать на уровне UI
    throw new Error('Не удалось сгенерировать документ. Попробуйте позже.');
  }
}

/**
 * Простая проверка соединения с API (опционально)
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await model.generateContent('Ответь "ok" если связь есть.');
    const text = result.response.text();
    return text.toLowerCase().includes('ok');
  } catch {
    return false;
  }
}