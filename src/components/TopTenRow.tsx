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

interface TopTenRowProps {
  title: string;
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
}

export const TopTenRow: React.FC<TopTenRowProps> = ({
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
        renderItem={({ item, index }) => {
          const rank = index + 1;
          return (
            <TouchableOpacity
              style={styles.cardContainer}
              activeOpacity={0.8}
              onPress={() => onItemPress(item)}
            >
              {/* Giant Rank Number */}
              <View style={styles.numberContainer}>
                <Text style={styles.rankStroke}>{rank}</Text>
                <Text style={styles.rankFill}>{rank}</Text>
              </View>

              {/* Poster Card */}
              <View style={styles.posterWrapper}>
                <Image
                  source={{ uri: item.poster }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>TOP 10</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
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
    gap: 4,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 155,
    height: 165,
    marginRight: 8,
  },
  numberContainer: {
    width: 55,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: -12,
    zIndex: 1,
  },
  rankStroke: {
    position: 'absolute',
    fontSize: 110,
    fontWeight: '900',
    color: '#595959',
    left: 2,
    fontFamily: 'System',
  },
  rankFill: {
    fontSize: 110,
    fontWeight: '900',
    color: '#000000',
    fontFamily: 'System',
    textShadowColor: '#737373',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 1,
  },
  posterWrapper: {
    flex: 1,
    height: 155,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.cardBackground,
    zIndex: 2,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  topBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  topBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
});
