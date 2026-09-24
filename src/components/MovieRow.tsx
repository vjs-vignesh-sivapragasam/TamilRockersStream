import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../constants/theme';
import { MediaItem } from '../data/sampleMedia';

interface MovieRowProps {
  title: string;
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  items,
  onItemPress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.rowTitle}>{title}</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.8}
            onPress={() => onItemPress(item)}
          >
            <Image
              source={{ uri: item.poster }}
              style={styles.posterImage}
              resizeMode="cover"
            />
            {item.quality === '4K Ultra HD' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>4K</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 16,
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  cardContainer: {
    width: 110,
    height: 160,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.cardBackground,
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
