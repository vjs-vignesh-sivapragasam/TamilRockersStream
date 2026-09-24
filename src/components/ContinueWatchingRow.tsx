import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Play, Info } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { MediaItem } from '../data/sampleMedia';

interface ContinueWatchingRowProps {
  title: string;
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
  onInfoPress: (item: MediaItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  title,
  items,
  onItemPress,
  onInfoPress,
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
        renderItem={({ item }) => {
          const progressPercent = Math.min(Math.max((item.progress || 0) * 100, 5), 100);
          return (
            <View style={styles.cardWrapper}>
              <TouchableOpacity
                style={styles.cardImageContainer}
                activeOpacity={0.8}
                onPress={() => onItemPress(item)}
              >
                <Image
                  source={{ uri: item.poster }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
                {/* Center Play overlay */}
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <Play color="#FFFFFF" size={18} fill="#FFFFFF" style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>

              {/* Bottom Control Bar */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => onInfoPress(item)}
                  activeOpacity={0.7}
                >
                  <Info color={Colors.textSecondary} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
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
    gap: 12,
  },
  cardWrapper: {
    width: 125,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    height: 3.5,
    backgroundColor: '#3A3A3A',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.netflixRed,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#1C1C1C',
  },
  infoBtn: {
    padding: 2,
  },
});
