import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, Platform, type StyleProp, type TextStyle } from 'react-native';

// Тип для имени иконки: только те, что есть в MAPPING (можно расширять)
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Сопоставление имён SF Symbols с именами MaterialIcons.
 * Добавляй сюда новые пары по мере необходимости.
 * - Список MaterialIcons: https://icons.expo.fyi
 * - Каталог SF Symbols: https://developer.apple.com/sf-symbols/
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'doc.text.fill': 'description',
  'doc.plaintext.fill': 'article',
  'doc.richtext.fill': 'assignment',
  'doc.plaintext': 'note',
  'plus.circle.fill': 'add-circle',
  'person.crop.circle': 'person',
  'clock.fill': 'history',
} as const satisfies Record<string, ComponentProps<typeof MaterialIcons>['name']>;

/**
 * Универсальный компонент иконки:
 * - на iOS использует нативный SF Symbol (expo-symbols)
 * - на Android и Web — MaterialIcons (из @expo/vector-icons)
 *
 * @param name — имя иконки в нотации SF Symbols (должно быть в MAPPING)
 * @param size — размер иконки (по умолчанию 24)
 * @param color — цвет иконки (строка или OpaqueColorValue)
 * @param weight — насыщенность (только для iOS, по умолчанию 'regular')
 * @param style — дополнительные стили для контейнера
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  weight = 'regular',
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  weight?: SymbolWeight;
  style?: StyleProp<TextStyle>;
}) {
  // iOS: используем нативный SymbolView
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={color as string} // OpaqueColorValue на iOS не поддерживается, поэтому приводим к строке
        weight={weight}
        style={style}
        type="hierarchical" // или 'palette' / 'monochrome' — можно вынести в пропс при необходимости
      />
    );
  }

  // Android / Web / etc: MaterialIcons
  const materialIconName = MAPPING[name] ?? 'help'; // fallback на 'help' если маппинга нет
  return (
    <MaterialIcons
      name={materialIconName}
      size={size}
      color={color as string}
      style={style}
    />
  );
}