import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { generateDocument } from '@/service/gemini-api';

type DocumentType = 'spravka' | 'zayavlenie' | 'prikaz' | 'dogovor';

type KeyboardType = 'default' | 'numeric' | 'email-address' | 'phone-pad';

type IconName =
  | 'person'
  | 'briefcase'
  | 'doc.text'
  | 'doc.plaintext'
  | 'doc.richtext'
  | 'calendar'
  | 'number'
  | 'signature'
  | 'building'
  | 'rublesign'
  | 'wand.and.stars'
  | 'chevron.left';

interface FormField {
  name: string;
  label: string;
  placeholder: string;
  icon?: IconName;
  multiline?: boolean;
  keyboardType?: KeyboardType;
  required?: boolean;
  pattern?: RegExp;
  errorMessage?: string;
  /** Доп.валидатор: возвращает текст ошибки или null */
  validate?: (value: string, all: Record<string, string>) => string | null;
}

type FormData = Record<string, string>;

const STORAGE_KEY = '@documents';

const SCREEN_TITLES: Record<DocumentType, string> = {
  spravka: 'Новая справка',
  zayavlenie: 'Новое заявление',
  prikaz: 'Новый приказ',
  dogovor: 'Новый договор',
};

function isValidDateDDMMYYYY(input: string): boolean {
  // input like 31.12.2026
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if (yyyy < 1900 || yyyy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;

  // Проверка календаря
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Лучше хранить сумму как "100000" (числа + пробелы разрешим),
 * а форматирование (пробелы/валюта/пропись) делать в документе.
 */
const FIELD_CONFIGS: Record<DocumentType, FormField[]> = {
  spravka: [
    { name: 'fullName', label: 'ФИО', placeholder: 'Адам Адам Адамұлы', icon: 'person', required: true },
    { name: 'position', label: 'Должность', placeholder: 'Менеджер', icon: 'briefcase', required: true },
    { name: 'purpose', label: 'Цель', placeholder: 'По месту требования', icon: 'doc.text', required: true },
    {
      name: 'issueDate',
      label: 'Дата выдачи',
      placeholder: 'ДД.ММ.ГГГГ',
      icon: 'calendar',
      required: true,
      pattern: /^\d{2}\.\d{2}\.\d{4}$/,
      errorMessage: 'Введите дату в формате ДД.ММ.ГГГГ',
      validate: (v) => (isValidDateDDMMYYYY(v) ? null : 'Некорректная дата'),
    },
  ],
  zayavlenie: [
    { name: 'toWhom', label: 'Кому', placeholder: 'Директору ООО "Ромашка" Иванову И.И.', icon: 'person', required: true },
    { name: 'fromWhom', label: 'От кого', placeholder: 'Петрова П.П.', icon: 'person', required: true },
    { name: 'body', label: 'Текст заявления', placeholder: 'Прошу предоставить отпуск с ...', icon: 'doc.plaintext', multiline: true, required: true },
    {
      name: 'date',
      label: 'Дата',
      placeholder: 'ДД.ММ.ГГГГ',
      icon: 'calendar',
      required: true,
      pattern: /^\d{2}\.\d{2}\.\d{4}$/,
      errorMessage: 'Введите дату в формате ДД.ММ.ГГГГ',
      validate: (v) => (isValidDateDDMMYYYY(v) ? null : 'Некорректная дата'),
    },
  ],
  prikaz: [
    { name: 'number', label: 'Номер приказа', placeholder: '123-к', icon: 'number', required: true },
    { name: 'title', label: 'Заголовок', placeholder: 'О приёме на работу', icon: 'doc.text', required: true },
    { name: 'content', label: 'Текст приказа', placeholder: 'ПРИКАЗЫВАЮ:\n1. ...', icon: 'doc.richtext', multiline: true, required: true },
    { name: 'signature', label: 'Подпись', placeholder: 'Директор Иванов И.И.', icon: 'signature', required: true },
    {
      name: 'date',
      label: 'Дата',
      placeholder: 'ДД.ММ.ГГГГ',
      icon: 'calendar',
      required: true,
      pattern: /^\d{2}\.\d{2}\.\d{4}$/,
      errorMessage: 'Введите дату в формате ДД.ММ.ГГГГ',
      validate: (v) => (isValidDateDDMMYYYY(v) ? null : 'Некорректная дата'),
    },
  ],
  dogovor: [
    { name: 'party1', label: 'Сторона 1', placeholder: 'ООО "Истец" в лице ...', icon: 'building', required: true },
    { name: 'party2', label: 'Сторона 2', placeholder: 'ИП Петров П.П.', icon: 'building', required: true },
    { name: 'subject', label: 'Предмет договора', placeholder: 'Оказание услуг ...', icon: 'doc.text', multiline: true, required: true },
    {
      name: 'amount',
      label: 'Сумма (только цифры)',
      placeholder: '100000 или 100 000',
      icon: 'rublesign',
      keyboardType: 'numeric',
      required: true,
      pattern: /^\d[\d\s]*$/,
      errorMessage: 'Введите сумму цифрами (допускаются пробелы)',
      validate: (v) => {
        const digits = v.replace(/\s/g, '');
        if (!digits) return 'Поле обязательно';
        if (!/^\d+$/.test(digits)) return 'Только цифры';
        if (Number(digits) <= 0) return 'Сумма должна быть больше 0';
        return null;
      },
    },
    {
      name: 'term',
      label: 'Срок действия',
      placeholder: 'с ДД.ММ.ГГГГ по ДД.ММ.ГГГГ',
      icon: 'calendar',
      required: true,
      pattern: /^с \d{2}\.\d{2}\.\d{4} по \d{2}\.\d{2}\.\d{4}$/,
      errorMessage: 'Введите срок в формате "с ДД.ММ.ГГГГ по ДД.ММ.ГГГГ"',
      validate: (v) => {
        const m = /^с (\d{2}\.\d{2}\.\d{4}) по (\d{2}\.\d{2}\.\d{4})$/.exec(v);
        if (!m) return null; // regex уже поймает
        const from = m[1];
        const to = m[2];
        if (!isValidDateDDMMYYYY(from) || !isValidDateDDMMYYYY(to)) return 'Некорректные даты';
        const [fd, fm, fy] = from.split('.').map(Number);
        const [td, tm, ty] = to.split('.').map(Number);
        const d1 = new Date(fy, fm - 1, fd).getTime();
        const d2 = new Date(ty, tm - 1, td).getTime();
        if (d2 < d1) return 'Дата окончания меньше даты начала';
        return null;
      },
    },
  ],
};

function getFullTypeName(type: DocumentType): string {
  switch (type) {
    case 'spravka': return 'Справка';
    case 'zayavlenie': return 'Заявление';
    case 'prikaz': return 'Приказ';
    case 'dogovor': return 'Договор';
  }
}

function getDocumentTitle(type: DocumentType, data: FormData): string {
  switch (type) {
    case 'spravka':
      return normalizeSpaces(`Справка ${data.fullName ?? ''}`);
    case 'zayavlenie':
      return normalizeSpaces(`Заявление ${data.fromWhom ?? ''}`);
    case 'prikaz':
      return normalizeSpaces(`Приказ №${data.number ?? ''} ${data.title ?? ''}`);
    case 'dogovor':
      return normalizeSpaces(`Договор ${data.subject ?? ''}`);
  }
}

/**
 * Жёсткий контракт: модель НЕ имеет права добавлять реквизиты.
 * Если данных не хватает — ставит "________________" (пустое место), не выдумывает.
 */
function createPrompt(type: DocumentType, data: FormData, templateTitle?: string): string {
  const templateContext = templateTitle ? `Выбранный шаблон: "${templateTitle}".\n` : '';

  // Важно: фиксируем правила вывода и структуру
  const header = `
${templateContext}ЗАДАЧА:
Сгенерировать официальный документ (Республика Казахстан) по типу: ${getFullTypeName(type)}.

КРИТИЧЕСКИЕ ПРАВИЛА (обязательны):
1) Используй ТОЛЬКО данные из блока "ВХОДНЫЕ ДАННЫЕ". Запрещено добавлять любые новые реквизиты/поля (БИН, адрес, ИИК, телефоны, e-mail, даты, номера, ФИО и т.д.), если они не переданы во входных данных.
2) Если какого-то реквизита не хватает для "идеального" документа — поставь "________________" вместо него. НЕ придумывай.
3) Выводи ТОЛЬКО текст документа между маркерами:
BEGIN_DOCUMENT
...текст...
END_DOCUMENT
Никаких комментариев, пояснений, markdown, списков правил — только документ.
4) Все перечисленные входные поля должны быть использованы в тексте (каждое хотя бы один раз).

`;

  // Для каждого типа — задаём СТРОГИЙ шаблон, чтобы модель не импровизировала с “полями”
  switch (type) {
    case 'spravka':
      return header + `
ВХОДНЫЕ ДАННЫЕ:
- ФИО: ${data.fullName}
- Должность: ${data.position}
- Цель выдачи: ${data.purpose}
- Дата выдачи: ${data.issueDate}

ФОРМАТ (строго соблюдай блоки и заголовки):
BEGIN_DOCUMENT
[Полное наименование организации: ________________]
[Исх. № ________________ от ${data.issueDate}]

СПРАВКА

Выдана: ${data.fullName}, в том, что он(а) работает в должности: ${data.position}.
Справка выдана для цели: ${data.purpose}.

Руководитель: ________________ / ________________
М.П.

Дата выдачи: ${data.issueDate}
END_DOCUMENT
`;

    case 'zayavlenie':
      return header + `
ВХОДНЫЕ ДАННЫЕ:
- Кому: ${data.toWhom}
- От кого: ${data.fromWhom}
- Содержание: ${data.body}
- Дата: ${data.date}

ФОРМАТ (строго соблюдай блоки и заголовки):
BEGIN_DOCUMENT
${data.toWhom}
от ${data.fromWhom}

ЗАЯВЛЕНИЕ

${data.body}

Подпись: ________________ / ${data.fromWhom}
Дата: ${data.date}
END_DOCUMENT
`;

    case 'prikaz':
      return header + `
ВХОДНЫЕ ДАННЫЕ:
- Номер: ${data.number}
- Заголовок: ${data.title}
- Текст (основа): ${data.content}
- Подпись: ${data.signature}
- Дата: ${data.date}

ФОРМАТ (строго соблюдай блоки и заголовки):
BEGIN_DOCUMENT
[Полное наименование организации: ________________]

ПРИКАЗ № ${data.number}
${data.date}
${data.title}

${data.content}

Руководитель: ${data.signature}
END_DOCUMENT
`;

    case 'dogovor': {
      const amountDigits = (data.amount ?? '').replace(/\s/g, '');
      return header + `
ВХОДНЫЕ ДАННЫЕ:
- Сторона 1: ${data.party1}
- Сторона 2: ${data.party2}
- Предмет: ${data.subject}
- Сумма (цифрами): ${data.amount}
- Сумма (без пробелов): ${amountDigits}
- Срок действия: ${data.term}

ФОРМАТ (строго соблюдай блоки и заголовки):
BEGIN_DOCUMENT
ДОГОВОР
[№ ________________]
[г. ________________]                                                [дата: ________________]

1. СТОРОНЫ ДОГОВОРА
1.1. Сторона 1: ${data.party1}.
1.2. Сторона 2: ${data.party2}.

2. ПРЕДМЕТ ДОГОВОРА
2.1. ${data.subject}

3. СТОИМОСТЬ И ПОРЯДОК РАСЧЕТОВ
3.1. Цена договора составляет: ${data.amount} (цифрами), прописью: ________________ тенге/рублей (укажи валюту как "________________", если она не задана).
3.2. Порядок оплаты: ________________.

4. СРОК ДЕЙСТВИЯ
4.1. Договор действует: ${data.term}.

5. ОТВЕТСТВЕННОСТЬ СТОРОН
5.1. ________________.

6. РАЗРЕШЕНИЕ СПОРОВ
6.1. ________________.

7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
7.1. ________________.

8. ПОДПИСИ СТОРОН
Сторона 1: ______________________
Сторона 2: ______________________
END_DOCUMENT
`;
    }
  }
}

export default function DocumentFormScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const params = useLocalSearchParams<{
    templateId?: string;
    type?: DocumentType;
    templateTitle?: string;
  }>();

  const documentType: DocumentType = (params.type ?? 'spravka') as DocumentType;
  const templateTitle = params.templateTitle;

  const fields = useMemo(() => FIELD_CONFIGS[documentType], [documentType]);

  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Инициализация формы под тип
  useEffect(() => {
    const initialData: FormData = {};
    for (const f of fields) initialData[f.name] = '';
    setFormData(initialData);
    setFieldErrors({});
  }, [fields]);

  const handleChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const raw = formData[field.name] ?? '';
      const value = raw.trim();

      if (field.required && !value) {
        errors[field.name] = 'Поле обязательно';
        continue;
      }

      if (field.pattern && value && !field.pattern.test(value)) {
        errors[field.name] = field.errorMessage || 'Неверный формат';
        continue;
      }

      if (field.validate && value) {
        const extra = field.validate(value, formData);
        if (extra) {
          errors[field.name] = extra;
          continue;
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fields, formData]);

  const handleGenerate = useCallback(async () => {
    if (loading) return;

    const ok = validateForm();
    if (!ok) {
      Alert.alert('Ошибка', 'Проверьте правильность заполнения полей');
      return;
    }

    setLoading(true);
    try {
      const prompt = createPrompt(documentType, formData, templateTitle);
      const generatedContentRaw = await generateDocument(prompt);

      // Доп.страховка: вытаскиваем только то, что между маркерами
      const m = /BEGIN_DOCUMENT([\s\S]*?)END_DOCUMENT/.exec(generatedContentRaw);
      const generatedContent = m ? m[1].trim() : generatedContentRaw.trim();

      const newDocument = {
        id: Date.now().toString(),
        title: getDocumentTitle(documentType, formData),
        date: new Date().toISOString(),
        type: documentType,
        content: generatedContent,
      };

      const existingJson = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = safeJsonParse<any[]>(existingJson, []);
      const updated = [newDocument, ...existing];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      router.push({ pathname: '/preview', params: { id: newDocument.id } });
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось сгенерировать документ. Проверьте подключение к интернету и API-ключ.',
        [
          { text: 'Повторить', onPress: () => handleGenerate() },
          { text: 'Отмена', style: 'cancel' },
        ],
      );
    } finally {
      setLoading(false);
    }
  }, [documentType, formData, loading, router, templateTitle, validateForm]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>{SCREEN_TITLES[documentType]}</Text>
          {templateTitle ? (
            <Text style={[styles.templateSubtitle, { color: colors.textSecondary }]}>
              Шаблон: {templateTitle}
            </Text>
          ) : null}
        </View>

        <View style={{ width: 40 }} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.formCard}>
            {fields.map((field) => (
              <View key={field.name} style={styles.fieldContainer}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {field.label}{' '}
                  {field.required ? <Text style={{ color: '#FF6B6B' }}>*</Text> : null}
                </Text>

                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.card, borderColor: colors.textSecondary + '30' },
                    fieldErrors[field.name] ? styles.inputError : null,
                  ]}
                >
                  {field.icon ? (
                    <IconSymbol
                      name={field.icon as any}
                      size={20}
                      color={colors.textSecondary}
                      style={styles.inputIcon}
                    />
                  ) : null}

                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text },
                      field.multiline ? styles.multilineInput : null,
                    ]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textSecondary}
                    value={formData[field.name] ?? ''}
                    onChangeText={(text) => handleChange(field.name, text)}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 4 : 1}
                    textAlignVertical={field.multiline ? 'top' : 'center'}
                    keyboardType={field.keyboardType ?? 'default'}
                    autoCorrect={false}
                  />
                </View>

                {fieldErrors[field.name] ? (
                  <Text style={[styles.errorText, { color: '#FF6B6B' }]}>
                    {fieldErrors[field.name]}
                  </Text>
                ) : null}
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={loading}
              activeOpacity={0.8}
              style={styles.generateButtonWrapper}
            >
              <LinearGradient
                colors={['#4A90E2', '#9B59B6', '#E67E22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateButton}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.generateButtonText}>Сгенерировать</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },

  title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  templateSubtitle: { fontSize: 14, marginTop: 2 },

  keyboardView: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  formCard: {
    borderRadius: 24,
    padding: 4,
    marginBottom: 24,
  },

  fieldContainer: { marginBottom: 20 },

  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
  },

  inputError: { borderColor: '#FF6B6B', borderWidth: 2 },

  inputIcon: { marginRight: 8 },

  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },

  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  buttonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },

  generateButtonWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 220,
  },

  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});