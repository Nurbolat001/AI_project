import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Тип документа (копия из других экранов для независимости)
interface Document {
  id: string;
  title: string;
  date: string;
  type: 'spravka' | 'zayavlenie' | 'prikaz' | 'dogovor';
  content?: string;
}

// Человекочитаемые названия типов
const TYPE_LABELS: Record<Document['type'], string> = {
  spravka: 'Справка',
  zayavlenie: 'Заявление',
  prikaz: 'Приказ',
  dogovor: 'Договор',
};

export default function PreviewScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка документа по id
  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    if (!id) {
      setError('Документ не найден');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const json = await AsyncStorage.getItem('@documents');
      const docs: Document[] = json ? JSON.parse(json) : [];
      const found = docs.find(d => d.id === id);
      if (found) {
        setDocument(found);
      } else {
        setError('Документ не найден');
      }
    } catch (err) {
      setError('Ошибка загрузки документа');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты
  const formattedDate = document
    ? new Date(document.date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Поделиться текстом через системный Share
  const handleShare = async () => {
    if (!document?.content) return;
    try {
      await Share.share({
        message: document.content,
        title: document.title,
      });
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось открыть меню "Поделиться"');
    }
  };

    const handleCopy = async () => {
    if (!document?.content) return;
    Clipboard.setString(document.content);
    Alert.alert('Готово', 'Текст скопирован в буфер обмена');
  };

  // Создать PDF и поделиться/сохранить
  const handleExportPDF = async () => {
    if (!document?.content) return;

    try {
      // Формируем HTML для PDF с минимальным форматированием
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              padding: 40px;
              line-height: 1.5;
            }
            h1 {
              font-size: 24px;
              text-align: center;
              margin-bottom: 20px;
            }
            .meta {
              color: #666;
              margin-bottom: 30px;
              text-align: center;
            }
            .content {
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <h1>${document.title}</h1>
          <div class="meta">
            ${TYPE_LABELS[document.type]} • ${formattedDate}
          </div>
          <div class="content">${document.content.replace(/\n/g, '<br>')}</div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('PDF сохранён', `Файл: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось создать PDF');
      console.error(err);
    }
  };

  // Переход на главный экран
  const goHome = () => {
    router.push('/');
  };

  // Переход к созданию нового документа такого же типа
  const handleCreateSimilar = () => {
    if (!document) return;
    router.push({
      pathname: '/document-form',
      params: { type: document.type },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !document) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.centered}>
          <IconSymbol name="exclamationmark.triangle.fill" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error || 'Документ не найден'}
          </Text>
          <TouchableOpacity
            style={[styles.homeButton, { backgroundColor: colors.tint }]}
            onPress={goHome}
          >
            <Text style={styles.homeButtonText}>На главную</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['right', 'left','bottom']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* Шапка */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Предпросмотр</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Карточка документа */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={[styles.card, { backgroundColor: colors.card }]}
        >
          <Text style={[styles.documentTitle, { color: colors.text }]}>{document.title}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(document.type) + '20' }]}>
              <Text style={[styles.typeText, { color: getTypeColor(document.type) }]}>
                {TYPE_LABELS[document.type]}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formattedDate}</Text>
          </View>

          {/* Текст документа */}
          <View style={styles.contentContainer}>
            <Text style={[styles.contentText, { color: colors.text }]}>{document.content}</Text>
          </View>
        </Animated.View>

        {/* Панель действий */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.actionsContainer}
        >
          <Text style={[styles.actionsTitle, { color: colors.textSecondary }]}>Действия</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card }]}
              onPress={handleShare}
            >
              <IconSymbol name="square.and.arrow.up" size={24} color={colors.tint} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Поделиться</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card }]}
              onPress={handleCopy}
            >
              <IconSymbol name="doc.on.doc" size={24} color={colors.tint} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Копировать</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card }]}
              onPress={handleExportPDF}
            >
              <IconSymbol name="arrow.down.doc" size={24} color={colors.tint} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>PDF</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Кнопка создания похожего документа (с градиентом) */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.similarContainer}
        >
          <TouchableOpacity
            onPress={handleCreateSimilar}
            activeOpacity={0.8}
            style={styles.similarButtonWrapper}
          >
            <LinearGradient
              colors={[colors.card, colors.tint + '30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.similarButton}
            >
              <IconSymbol name="doc.badge.plus" size={24} color={colors.tint} />
              <Text style={[styles.similarText, { color: colors.text }]}>Создать похожий</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Кнопка на главную (яркий градиент) */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.homeButtonContainer}
        >
          <TouchableOpacity
            onPress={goHome}
            activeOpacity={0.8}
            style={styles.homeButtonWrapper}
          >
            <LinearGradient
              colors={['#4A90E2', '#9B59B6', '#E67E22']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.homeButton}
            >
              <Text style={styles.homeButtonText}>На главную</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Возвращает цвет для типа документа (как на главном экране)
function getTypeColor(type: Document['type']): string {
  switch (type) {
    case 'spravka':
      return '#4A90E2';
    case 'zayavlenie':
      return '#50C878';
    case 'prikaz':
      return '#FF6B6B';
    case 'dogovor':
      return '#9B59B6';
    default:
      return '#888';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
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
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 14,
  },
  contentContainer: {
    marginTop: 8,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  similarContainer: {
    marginBottom: 16,
  },
  similarButtonWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  similarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  similarText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  homeButtonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  homeButtonWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  homeButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
});