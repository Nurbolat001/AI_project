import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  SlideInRight,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ==================== ТИПЫ ====================
export interface Document {
  id: string;
  title: string;
  date: string; // ISO
  type: 'spravka' | 'zayavlenie' | 'prikaz' | 'dogovor';
  content?: string;
}

interface Template {
  id: string;
  title: string;
  icon: keyof typeof import('@/components/ui/icon-symbol').IconSymbolName; // но для простоты оставим string
  color: string;
  type: Document['type'];
}

// ==================== СТАТИЧЕСКИЕ ДАННЫЕ ====================
const POPULAR_TEMPLATES: Template[] = [
  {
    id: 't1',
    title: 'Справка',
    icon: 'doc.text.fill',
    color: '#4A90E2',
    type: 'spravka',
  },
  {
    id: 't2',
    title: 'Заявление',
    icon: 'doc.plaintext.fill',
    color: '#50C878',
    type: 'zayavlenie',
  },
  {
    id: 't3',
    title: 'Приказ',
    icon: 'doc.richtext.fill',
    color: '#FF6B6B',
    type: 'prikaz',
  },
  {
    id: 't4',
    title: 'Договор',
    icon: 'doc.plaintext',
    color: '#9B59B6',
    type: 'dogovor',
  },
];

const STORAGE_KEY = '@documents';

// ==================== ХУК ДЛЯ РАБОТЫ С ДОКУМЕНТАМИ ====================
function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const data = json ? JSON.parse(json) : [];
      // Сортируем по дате (сначала новые)
      data.sort((a: Document, b: Document) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить документы');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveDocuments = async (newDocs: Document[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
      setDocuments(newDocs);
    } catch (err) {
      setError('Не удалось сохранить документ');
    }
  };

  const addDocument = async (doc: Document) => {
    const updated = [doc, ...documents];
    await saveDocuments(updated);
  };

  const deleteDocument = async (id: string) => {
    const updated = documents.filter((d) => d.id !== id);
    await saveDocuments(updated);
  };

  const clearAll = async () => {
    await saveDocuments([]);
  };

  return {
    documents,
    loading,
    error,
    loadDocuments,
    addDocument,
    deleteDocument,
    clearAll,
  };
}

// ==================== КОМПОНЕНТ КАРТОЧКИ ДОКУМЕНТА ====================
const DocumentCard = ({
  document,
  onPress,
  onDelete,
  colors,
  index,
}: {
  document: Document;
  onPress: () => void;
  onDelete: () => void;
  colors: typeof Colors.light;
  index: number;
}) => {
  const formattedDate = new Date(document.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const getIconName = (type: Document['type']) => {
    switch (type) {
      case 'spravka':
        return 'doc.text.fill';
      case 'zayavlenie':
        return 'doc.plaintext.fill';
      case 'prikaz':
        return 'doc.richtext.fill';
      case 'dogovor':
        return 'doc.plaintext';
      default:
        return 'doc.text.fill';
    }
  };

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={onDelete}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FF6B6B', '#EE5A5A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.deleteGradient}
      >
        <IconSymbol name="trash.fill" size={24} color="#fff" />
        <Text style={styles.deleteText}>Удалить</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      entering={SlideInRight.delay(index * 100).springify()}
      layout={Layout.springify()}
    >
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        containerStyle={styles.swipeableContainer}
      >
        <TouchableOpacity
          style={[styles.documentCard, { backgroundColor: colors.card }]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.documentCardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
              <IconSymbol name={getIconName(document.type)} size={20} color={colors.tint} />
            </View>
            <Text style={[styles.documentDate, { color: colors.textSecondary }]}>
              {formattedDate}
            </Text>
          </View>
          <Text style={[styles.documentTitle, { color: colors.text }]} numberOfLines={2}>
            {document.title}
          </Text>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
};

// ==================== КОМПОНЕНТ СПИСКА ПОСЛЕДНИХ ДОКУМЕНТОВ ====================
const RecentDocumentsList = ({
  documents,
  onDocumentPress,
  onDeleteDocument,
  colors,
}: {
  documents: Document[];
  onDocumentPress: (doc: Document) => void;
  onDeleteDocument: (id: string) => void;
  colors: typeof Colors.light;
}) => {
  if (documents.length === 0) {
    return (
      <Animated.View
        entering={FadeInUp.delay(200)}
        style={[styles.emptyState, { backgroundColor: colors.card }]}
      >
        <IconSymbol name="doc.text.magnifyingglass" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Здесь пока пусто
        </Text>
        <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
          Создайте первый документ
        </Text>
      </Animated.View>
    );
  }

  return (
    <FlatList
      data={documents.slice(0, 5)}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <DocumentCard
          document={item}
          onPress={() => onDocumentPress(item)}
          onDelete={() => onDeleteDocument(item.id)}
          colors={colors}
          index={index}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      contentContainerStyle={styles.recentList}
    />
  );
};

// ==================== КОМПОНЕНТ ПОПУЛЯРНЫХ ШАБЛОНОВ ====================
const PopularTemplatesList = ({
  onTemplatePress,
  colors,
}: {
  onTemplatePress: (template: Template) => void;
  colors: typeof Colors.light;
}) => {
  return (
    <FlatList
      data={POPULAR_TEMPLATES}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <Animated.View
          entering={FadeInDown.delay(300 + index * 100).springify()}
          style={styles.templateCardWrapper}
        >
          <TouchableOpacity
            style={[styles.templateCard, { backgroundColor: colors.card }]}
            onPress={() => onTemplatePress(item)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[item.color + '30', item.color + '10']}
              style={styles.templateGradient}
            >
              <View style={[styles.templateIcon, { backgroundColor: item.color + '20' }]}>
                <IconSymbol name={item.icon as any} size={32} color={item.color} />
              </View>
              <Text style={[styles.templateTitle, { color: colors.text }]}>{item.title}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
      ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
      contentContainerStyle={styles.templateList}
    />
  );
};

// ==================== ГЛАВНЫЙ ЭКРАН ====================
export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { documents, loading, error, loadDocuments, deleteDocument } = useDocuments();

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  }, []);

  const handleDocumentPress = (doc: Document) => {
    router.push({
      pathname: '/preview',
      params: { id: doc.id },
    });
  };

  const handleTemplatePress = (template: Template) => {
    router.push({
      pathname: '/document-form',
      params: { templateId: template.id, type: template.type },
    });
  };

  const handleCreateDocument = () => {
    router.push('/document-form');
  };

  const handleDeleteDocument = (id: string) => {
    Alert.alert(
      'Удаление документа',
      'Вы уверены, что хотите удалить этот документ?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => deleteDocument(id),
        },
      ],
      { cancelable: true }
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }
      >
        <Animated.View
          entering={FadeInDown.duration(600)}
          style={styles.content}
        >
          {/* Шапка — без имени пользователя, просто иконка инструмента */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                {getGreeting()}!
              </Text>
              <Text style={[styles.appName, { color: colors.text }]}>
                DocuGen AI
              </Text>
            </View>
            <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
              <IconSymbol name="doc.text.fill" size={32} color={colors.tint} />
            </View>
          </View>

          {/* Кнопка создания документа с градиентом */}
          <TouchableOpacity
            onPress={handleCreateDocument}
            activeOpacity={0.9}
            style={styles.createButtonWrapper}
          >
            <LinearGradient
              colors={[colors.tint, colors.tint + 'dd']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButton}
            >
              <IconSymbol name="plus.circle.fill" size={24} color={colorScheme === 'dark' ? '#000000' : '#ffffff'} />
              <Text style={[styles.createButtonText, { color: colorScheme === 'dark' ? '#000000' : '#ffffff' }]}>Создать документ</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Раздел последних документов */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Недавние документы</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={[styles.seeAll, { color: colors.tint }]}>Все</Text>
              </TouchableOpacity>
            </View>

            <RecentDocumentsList
              documents={documents}
              onDocumentPress={handleDocumentPress}
              onDeleteDocument={handleDeleteDocument}
              colors={colors}
            />
          </View>

          {/* Раздел популярных шаблонов */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Популярные шаблоны</Text>
            <PopularTemplatesList onTemplatePress={handleTemplatePress} colors={colors} />
          </View>

          {/* Сообщение об ошибке, если есть */}
          {error && (
            <Animated.View
              entering={FadeInUp}
              style={[styles.errorContainer, { backgroundColor: colors.card }]}
            >
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#FF6B6B" />
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
              <TouchableOpacity onPress={loadDocuments}>
                <Text style={[styles.retryText, { color: colors.tint }]}>Повторить</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Небольшой отступ снизу */}
          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== СТИЛИ ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '400',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonWrapper: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 16,
    fontWeight: '500',
  },
  recentList: {
    paddingRight: 20,
  },
  swipeableContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  documentCard: {
    width: 170,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  documentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  documentDate: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    width: 80,
    height: '100%',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  deleteGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  templateList: {
    paddingRight: 20,
  },
  templateCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  templateCard: {
    width: 110,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  templateGradient: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  retryText: {
    fontWeight: '600',
    marginLeft: 8,
  },
});