import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Тип шаблона (такой же как на главном экране, можно вынести в общие типы)
interface Template {
  id: string;
  title: string;
  icon: keyof typeof import('@/components/ui/icon-symbol').IconSymbolName;
  color: string;
  type: 'spravka' | 'zayavlenie' | 'prikaz' | 'dogovor';
}

// Все доступные шаблоны (расширенная версия)
const ALL_TEMPLATES: Template[] = [
  { id: 't1', title: 'Справка о доходах', icon: 'doc.text.fill', color: '#4A90E2', type: 'spravka' },
  { id: 't2', title: 'Справка об обучении', icon: 'doc.text.fill', color: '#4A90E2', type: 'spravka' },
  { id: 't3', title: 'Заявление на отпуск', icon: 'doc.plaintext.fill', color: '#50C878', type: 'zayavlenie' },
  { id: 't4', title: 'Заявление на увольнение', icon: 'doc.plaintext.fill', color: '#50C878', type: 'zayavlenie' },
  { id: 't5', title: 'Приказ о приёме', icon: 'doc.richtext.fill', color: '#FF6B6B', type: 'prikaz' },
  { id: 't6', title: 'Приказ о премировании', icon: 'doc.richtext.fill', color: '#FF6B6B', type: 'prikaz' },
  { id: 't7', title: 'Договор подряда', icon: 'doc.plaintext', color: '#9B59B6', type: 'dogovor' },
  { id: 't8', title: 'Договор аренды', icon: 'doc.plaintext', color: '#9B59B6', type: 'dogovor' },
  { id: 't9', title: 'Справка 2-НДФЛ', icon: 'doc.text.fill', color: '#4A90E2', type: 'spravka' },
  { id: 't10', title: 'Заявление на матпомощь', icon: 'doc.plaintext.fill', color: '#50C878', type: 'zayavlenie' },
];

// Компонент карточки шаблона для сетки
const TemplateGridItem = ({ template, onPress, colors }: { template: Template; onPress: () => void; colors: typeof Colors.light }) => (
  <Animated.View
    entering={FadeInDown.springify().mass(0.5)}
    style={styles.gridItemWrapper}
  >
    <TouchableOpacity
      style={[styles.gridItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={[template.color + '20', template.color + '05']}
        style={styles.gridGradient}
      >
        <View style={[styles.gridIconContainer, { backgroundColor: template.color + '20' }]}>
          <IconSymbol name={template.icon} size={32} color={template.color} />
        </View>
        <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
          {template.title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
);

// Компонент пустого состояния при поиске
const EmptySearch = ({ colors, query }: { colors: typeof Colors.light; query: string }) => (
  <Animated.View entering={FadeIn} style={styles.emptyContainer}>
    <IconSymbol name="magnifyingglass" size={64} color={colors.textSecondary} />
    <Text style={[styles.emptyText, { color: colors.text }]}>Ничего не найдено</Text>
    <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
      По запросу «{query}» нет шаблонов
    </Text>
  </Animated.View>
);

export default function TemplatesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');

  // Фильтрация шаблонов по поисковому запросу
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return ALL_TEMPLATES;
    const lowerQuery = searchQuery.toLowerCase();
    return ALL_TEMPLATES.filter(t => t.title.toLowerCase().includes(lowerQuery));
  }, [searchQuery]);

    const handleTemplatePress = (template: Template) => {
        router.push({
            pathname: '/document-form',
            params: {
            templateId: template.id,
            type: template.type,
            templateTitle: template.title,
            },
        });
    };

  const clearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* Шапка */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Шаблоны</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {filteredTemplates.length} {getWordForm(filteredTemplates.length, ['шаблон', 'шаблона', 'шаблонов'])}
        </Text>
      </View>

      {/* Поиск */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Поиск по названию"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Сетка шаблонов */}
      <FlatList
        data={filteredTemplates}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TemplateGridItem
            template={item}
            onPress={() => handleTemplatePress(item)}
            colors={colors}
          />
        )}
        ListEmptyComponent={<EmptySearch colors={colors} query={searchQuery} />}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// Вспомогательная функция для склонения (простая)
function getWordForm(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridItemWrapper: {
    width: '48%', // две колонки с отступом
  },
  gridItem: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  gridGradient: {
    padding: 16,
    alignItems: 'center',
  },
  gridIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});