import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Play, CheckCircle2, HardDrive, ArrowRight, DownloadCloud, Folder } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { DownloadItem } from '../types/downloads';
import { formatBytes, getStorageLocationText } from '../services/downloadService';

interface DownloadedMoviesRowProps {
  items: DownloadItem[];
  onPlayItem: (item: DownloadItem) => void;
  onViewAll?: () => void;
  onBrowsePress?: () => void;
}

const DEFAULT_POSTERS: Record<string, string> = {
  sintel: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
  bunny: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80',
  tears: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
  ubuntu: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
  default: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80',
};

export const getDownloadItemPoster = (item: DownloadItem): string => {
  if (item.poster) return item.poster;
  const name = (item.title || item.movieFileName || item.fileName || '').toLowerCase();
  if (name.includes('sintel')) return DEFAULT_POSTERS.sintel;
  if (name.includes('bunny')) return DEFAULT_POSTERS.bunny;
  if (name.includes('tear')) return DEFAULT_POSTERS.tears;
  if (name.includes('ubuntu')) return DEFAULT_POSTERS.ubuntu;
  return DEFAULT_POSTERS.default;
};

export const DownloadedMoviesRow: React.FC<DownloadedMoviesRowProps> = ({
  items,
  onPlayItem,
  onViewAll,
  onBrowsePress,
}) => {
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.badgeOffline}>
              <CheckCircle2 color="#46D369" size={13} />
              <Text style={styles.badgeOfflineText}>OFFLINE READY</Text>
            </View>
            <Text style={styles.rowTitle}>Downloaded Movies</Text>
          </View>
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <DownloadCloud color={Colors.netflixRed} size={28} />
          </View>
          <View style={styles.emptyTextGroup}>
            <Text style={styles.emptyTitle}>No Movies Downloaded Yet</Text>
            <Text style={styles.emptySubtitle}>
              Download torrents or movie files from the Browser to watch offline anytime.
            </Text>
          </View>
          {onBrowsePress && (
            <TouchableOpacity
              style={styles.browseButton}
              onPress={onBrowsePress}
              activeOpacity={0.8}
            >
              <Text style={styles.browseButtonText}>Browse Movies</Text>
              <ArrowRight color="#FFFFFF" size={14} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.badgeOffline}>
            <CheckCircle2 color="#46D369" size={13} />
            <Text style={styles.badgeOfflineText}>SAVED TO DEVICE</Text>
          </View>
          <Text style={styles.rowTitle}>Downloaded Movies ({items.length})</Text>
        </View>

        {onViewAll && (
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={onViewAll}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Manage</Text>
            <ArrowRight color={Colors.netflixRed} size={14} />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Downloaded Movies List */}
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const posterUri = getDownloadItemPoster(item);
          const sizeText = item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Ready';
          const displayTitle = item.title || item.movieFileName || item.fileName;

          return (
            <TouchableOpacity
              style={styles.cardContainer}
              activeOpacity={0.85}
              onPress={() => onPlayItem(item)}
            >
              {/* Thumbnail Container */}
              <View style={styles.posterWrapper}>
                <Image
                  source={{ uri: posterUri }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />

                {/* Play Button Overlay */}
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <Play color="#FFFFFF" size={20} fill="#FFFFFF" style={{ marginLeft: 2 }} />
                  </View>
                </View>

                {/* Quality & Size Badges */}
                <View style={styles.badgesTopRow}>
                  <View style={styles.qualityBadge}>
                    <Text style={styles.qualityBadgeText}>
                      {item.resolution || '1080p'}
                    </Text>
                  </View>
                  <View style={styles.sizeBadge}>
                    <HardDrive color="#AAAAAA" size={10} style={{ marginRight: 3 }} />
                    <Text style={styles.sizeBadgeText}>{sizeText}</Text>
                  </View>
                </View>

                {/* Green Offline Bar */}
                <View style={styles.offlineStatusBar}>
                  <CheckCircle2 color="#46D369" size={11} />
                  <Text style={styles.offlineStatusText}>Offline Ready</Text>
                </View>
              </View>

              {/* Movie Title Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {displayTitle}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <Folder color="#46D369" size={10} />
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {getStorageLocationText(item.fileUri || item.movieFileUri)}
                  </Text>
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
  emptyContainer: {
    marginVertical: 14,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerLeft: {
    gap: 3,
  },
  badgeOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeOfflineText: {
    color: '#46D369',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewAllText: {
    color: Colors.netflixRed,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardContainer: {
    width: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  posterWrapper: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#121212',
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesTopRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  qualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  sizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sizeBadgeText: {
    color: '#DDDDDD',
    fontSize: 9,
    fontWeight: '600',
  },
  offlineStatusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 25, 15, 0.88)',
    paddingVertical: 4,
  },
  offlineStatusText: {
    color: '#46D369',
    fontSize: 9,
    fontWeight: '700',
  },
  cardFooter: {
    padding: 8,
    backgroundColor: Colors.surface,
    gap: 2,
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  itemSubtitle: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextGroup: {
    flex: 1,
    gap: 3,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 15,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
