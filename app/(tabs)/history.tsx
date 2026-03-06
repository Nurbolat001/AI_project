import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Тип документа
interface Document {
  id: string;
  title: string;
  date: string;
  type: 'spravka' | 'zayavlenie' | 'prikaz' | 'dogovor';
  content?: string;
}

type DocumentType = Document['type'] | 'all';
type SortOption = 'dateDesc' | 'dateAsc' | 'titleAsc' | 'titleDesc';

const STORAGE_KEY = '@documents';

// Хук для работы с документами
function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const data = json ? JSON.parse(json) : [];
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

  const deleteDocument = async (id: string) => {
    try {
      const updated = documents.filter((d) => d.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setDocuments(updated);
    } catch (err) {
      setError('Не удалось удалить документ');
    }
  };

  return {
    documents,
    loading,
    error,
    loadDocuments,
    deleteDocument,
  };
}

// Цвета для каждого типа (как в шаблонах)
const TYPE_COLORS: Record<Exclude<DocumentType, 'all'>, string> = {
  spravka: '#4A90E2',   // синий
  zayavlenie: '#50C878', // зелёный
  prikaz: '#FF6B6B',     // красный
  dogovor: '#9B59B6',    // фиолетовый
};

// Компонент фильтрующих чипсов с индивидуальными цветами
const FilterChips = ({
  selectedType,
  onSelectType,
  colors,
}: {
  selectedType: DocumentType;
  onSelectType: (type: DocumentType) => void;
  colors: typeof Colors.light;
}) => {
  const filters: { label: string; value: DocumentType; icon: string; color?: string }[] = [
    { label: 'Все', value: 'all', icon: 'tray.full', color: colors.textSecondary },
    { label: 'Справки', value: 'spravka', icon: 'doc.text.fill', color: TYPE_COLORS.spravka },
    { label: 'Заявления', value: 'zayavlenie', icon: 'doc.plaintext.fill', color: TYPE_COLORS.zayavlenie },
    { label: 'Приказы', value: 'prikaz', icon: 'doc.richtext.fill', color: TYPE_COLORS.prikaz },
    { label: 'Договоры', value: 'dogovor', icon: 'doc.plaintext', color: TYPE_COLORS.dogovor },
  ];

  return (
    <FlatList
      data={filters}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.value}
      renderItem={({ item }) => {
        const isSelected = selectedType === item.value;
        const backgroundColor = isSelected
          ? item.color ?? colors.tint
          : colors.card;
        const borderColor = isSelected
          ? item.color ?? colors.tint
          : colors.textSecondary + '30';
        const iconColor = isSelected ? '#fff' : (item.color ?? colors.textSecondary);
        const textColor = isSelected ? '#fff' : (item.color ?? colors.textSecondary);

        return (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor, borderColor },
            ]}
            onPress={() => onSelectType(item.value)}
            activeOpacity={0.7}
          >
            <IconSymbol name={item.icon as any} size={16} color={iconColor} />
            <Text style={[styles.filterChipText, { color: textColor }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.filterList}
    />
  );
};

// Компонент карточки документа
const HistoryDocumentCard = ({
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
    month: 'long',
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

  const getTypeLabel = (type: Document['type']) => {
    switch (type) {
      case 'spravka':
        return 'Справка';
      case 'zayavlenie':
        return 'Заявление';
      case 'prikaz':
        return 'Приказ';
      case 'dogovor':
        return 'Договор';
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
        <IconSymbol name="trash.fill" size={24} color="#ffffff" />
        <Text style={styles.deleteText}>Удалить</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify().mass(0.7)}
      layout={Layout.springify()}
      style={styles.cardWrapper}
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
          <View style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
              <IconSymbol name={getIconName(document.type)} size={28} color={colors.tint} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.documentTitle, { color: colors.text }]} numberOfLines={1}>
                {document.title}
              </Text>
              <View style={styles.metaContainer}>
                <Text style={[styles.documentType, { color: colors.textSecondary }]}>
                  {getTypeLabel(document.type)}
                </Text>
                <Text style={[styles.documentDate, { color: colors.textSecondary }]}>
                  {formattedDate}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
};

// Пустое состояние
const EmptyHistory = ({ colors, hasFilters }: { colors: typeof Colors.light; hasFilters: boolean }) => (
  <Animated.View entering={FadeIn} style={styles.emptyContainer}>
    <IconSymbol name="clock.arrow.circlepath" size={64} color={colors.textSecondary} />
    <Text style={[styles.emptyText, { color: colors.text }]}>
      {hasFilters ? 'Нет документов' : 'История пуста'}
    </Text>
    <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
      {hasFilters
        ? 'Попробуйте изменить фильтры'
        : 'Создайте первый документ на главном экране'}
    </Text>
  </Animated.View>
);

// Основной экран
export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { documents, loading, error, loadDocuments, deleteDocument } = useDocuments();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('dateDesc');

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

  const filteredAndSortedDocuments = useMemo(() => {
    let result = [...documents];

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(doc => doc.title.toLowerCase().includes(lowerQuery));
    }

    if (selectedType !== 'all') {
      result = result.filter(doc => doc.type === selectedType);
    }

    switch (sortOption) {
      case 'dateDesc':
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'dateAsc':
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'titleAsc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'titleDesc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return result;
  }, [documents, searchQuery, selectedType, sortOption]);

  const handleDocumentPress = (doc: Document) => {
    router.push({
      pathname: '/preview',
      params: { id: doc.id },
    });
  };

  const handleDelete = (id: string) => {
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

  const clearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const openSortMenu = () => {
    const options = [
      { label: 'Сначала новые', value: 'dateDesc' },
      { label: 'Сначала старые', value: 'dateAsc' },
      { label: 'По названию (А-Я)', value: 'titleAsc' },
      { label: 'По названию (Я-А)', value: 'titleDesc' },
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Отмена', ...options.map(o => o.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setSortOption(options[buttonIndex - 1].value as SortOption);
          }
        }
      );
    } else {
      Alert.alert(
        'Сортировка',
        'Выберите вариант',
        [
          { text: 'Отмена', style: 'cancel' },
          ...options.map(opt => ({
            text: opt.label,
            onPress: () => setSortOption(opt.value as SortOption),
          })),
        ],
        { cancelable: true }
      );
    }
  };

  const hasActiveFilters = searchQuery.length > 0 || selectedType !== 'all';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>История</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {filteredAndSortedDocuments.length} {getWordForm(filteredAndSortedDocuments.length, ['документ', 'документа', 'документов'])}
        </Text>
      </View>

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

      <View style={styles.filterRow}>
        <FilterChips selectedType={selectedType} onSelectType={setSelectedType} colors={colors} />
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.card }]}
          onPress={openSortMenu}
          activeOpacity={0.7}
        >
          <IconSymbol name="arrow.up.arrow.down" size={20} color={colors.tint} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAndSortedDocuments}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <HistoryDocumentCard
            document={item}
            onPress={() => handleDocumentPress(item)}
            onDelete={() => handleDelete(item.id)}
            colors={colors}
            index={index}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }
        ListEmptyComponent={
          loading ? null : <EmptyHistory colors={colors} hasFilters={hasActiveFilters} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={() => <View style={{ height: 20 }} />}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
    </SafeAreaView>
  );
}

function getWordForm(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
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
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingRight: 20,
  },
  filterList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  swipeableContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  documentCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentType: {
    fontSize: 14,
    marginRight: 8,
  },
  documentDate: {
    fontSize: 14,
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});