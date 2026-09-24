import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  TrendingUp,
  Plus,
  ShieldCheck,
  Search,
  Sparkles,
  Film,
  Trash2,
  Download,
  FileCode,
  Clock,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { BookmarkItem, HistoryItem } from '../../types/browser';

interface BrowserStartPageProps {
  bookmarks: BookmarkItem[];
  onSelectBookmark: (url: string) => void;
  onOpenAddModal: () => void;
  onDeleteBookmark: (id: string) => void;
  onSearchTag: (tag: string) => void;
  adBlockActive: boolean;
  blockedTotal: number;
  onDownloadTorrent?: (url: string, title?: string) => void;
  history?: HistoryItem[];
  onDeleteHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
}

const SEARCH_SHORTCUTS = [
  'Latest Box Office',
  '4K Action Movies',
  'Sci-Fi Blockbusters',
  'New Anime Series',
  'Award Winning Dramas',
];

export const BrowserStartPage: React.FC<BrowserStartPageProps> = ({
  bookmarks,
  onSelectBookmark,
  onOpenAddModal,
  onDeleteBookmark,
  onSearchTag,
  adBlockActive,
  blockedTotal,
  onDownloadTorrent,
  history,
  onDeleteHistoryItem,
  onClearHistory,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredBookmarks =
    activeCategory === 'All'
      ? bookmarks
      : bookmarks.filter((b) => b.category === activeCategory);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Privacy Shield Banner */}
      <View style={styles.privacyBanner}>
        <View style={styles.privacyIconWrapper}>
          <ShieldCheck color="#46d369" size={22} />
        </View>
        <View style={styles.privacyTextGroup}>
          <Text style={styles.privacyTitle}>
            Ad Shield & Popup Protection {adBlockActive ? 'ON' : 'OFF'}
          </Text>
          <Text style={styles.privacySubtitle}>
            {blockedTotal} trackers and intrusive ads blocked
          </Text>
        </View>
        <View style={styles.statusDot} />
      </View>

      {/* Speed Dial Category Filter Pills */}
      <View style={styles.categoriesRow}>
        {['All', 'Cinema', 'Media', 'Search', 'Custom'].map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, isActive && styles.catPillActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Speed Dial Grid Header */}
      <View style={styles.gridHeader}>
        <View style={styles.gridHeaderLeft}>
          <TrendingUp color={Colors.netflixRed} size={18} />
          <Text style={styles.gridTitle}>Speed Dial & Bookmarks</Text>
        </View>
        <TouchableOpacity
          style={styles.addShortcutBtn}
          onPress={onOpenAddModal}
          activeOpacity={0.8}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={styles.addShortcutText}>Add URL</Text>
        </TouchableOpacity>
      </View>

      {/* Bookmarks Grid */}
      <View style={styles.grid}>
        {filteredBookmarks.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.gridCard}
            activeOpacity={0.75}
            onPress={() => onSelectBookmark(item.url)}
          >
            <View style={[styles.iconBox, { backgroundColor: item.color || '#2A2A2A' }]}>
              <Text style={styles.iconLetter}>{item.iconLetter}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.category === 'Custom' && (
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => onDeleteBookmark(item.id)}
              >
                <Trash2 color="#FF4D4D" size={12} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        {/* Add Shortcut Tile */}
        <TouchableOpacity
          style={styles.addCardTile}
          onPress={onOpenAddModal}
          activeOpacity={0.75}
        >
          <View style={styles.addIconCircle}>
            <Plus color="#888888" size={24} />
          </View>
          <Text style={styles.addCardTitle}>New Site</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Torrent Downloads Section */}
      {onDownloadTorrent && (
        <View style={styles.torrentSection}>
          <View style={styles.sectionHeader}>
            <FileCode color={Colors.netflixRed} size={16} />
            <Text style={styles.sectionHeaderText}>Instant Torrent Downloads</Text>
          </View>
          <View style={styles.torrentList}>
            {[
              {
                title: 'Big Buck Bunny (Blender 4K)',
                size: '276 MB',
                url: 'https://webtorrent.io/torrents/big-buck-bunny.torrent',
                poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80',
              },
              {
                title: 'Sintel (Animation Sci-Fi)',
                size: '129 MB',
                url: 'https://webtorrent.io/torrents/sintel.torrent',
                poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
              },
              {
                title: 'Tears of Steel (4K Sci-Fi)',
                size: '571 MB',
                url: 'https://webtorrent.io/torrents/tears-of-steel.torrent',
                poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
              },
              {
                title: 'Ubuntu 24.04 Desktop ISO',
                size: '5.8 GB',
                url: 'https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso.torrent',
                poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
              },
            ].map((t) => (
              <TouchableOpacity
                key={t.url}
                style={styles.torrentRowCard}
                onPress={() => onDownloadTorrent(t.url, t.title)}
                activeOpacity={0.75}
              >
                <Image
                  source={{ uri: t.poster }}
                  style={styles.torrentThumbnail}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.torrentRowTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={styles.torrentRowMeta}>
                    Torrent file • {t.size}
                  </Text>
                </View>
                <View style={styles.torrentDlBtn}>
                  <Download color="#FFFFFF" size={13} />
                  <Text style={styles.torrentDlBtnText}>Download</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Previous History Section */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Clock color="#888888" size={16} />
            <Text style={styles.sectionHeaderText}>Previous History</Text>
          </View>
          {history && history.length > 0 && onClearHistory && (
            <TouchableOpacity onPress={onClearHistory} activeOpacity={0.7}>
              <Text style={styles.clearHistoryText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.historyList}>
          {history && history.length > 0 ? (
            history.slice(0, 10).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyRow}
                onPress={() => onSelectBookmark(item.url)}
                activeOpacity={0.7}
              >
                <View style={styles.historyIconCircle}>
                  <Clock color="#888888" size={15} />
                </View>
                <View style={styles.historyTextGroup}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.historyUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                {onDeleteHistoryItem && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
                    }}
                    style={styles.deleteHistoryBtn}
                    activeOpacity={0.7}
                  >
                    <Trash2 color="#555555" size={14} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryText}>No previous browsing history yet</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B1B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#292929',
    gap: 12,
  },
  privacyIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(70, 211, 105, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyTextGroup: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  privacySubtitle: {
    color: '#9E9E9E',
    fontSize: 11,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#46d369',
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#202020',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  catPillActive: {
    backgroundColor: Colors.netflixRed,
    borderColor: Colors.netflixRed,
  },
  catPillText: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  addShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#262626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addShortcutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  iconLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#D4D4D4',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteBadge: {
    position: 'absolute',
    top: -4,
    right: 2,
    backgroundColor: '#1E1E1E',
    padding: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#444',
  },
  addCardTile: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
  },
  addIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3D3D3D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardTitle: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '600',
  },
  searchSection: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionHeaderText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historySection: {
    marginBottom: 24,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearHistoryText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  historyList: {
    gap: 8,
    marginTop: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    padding: 10,
    borderRadius: 8,
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
  },
  historyIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTextGroup: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  historyUrl: {
    color: '#777777',
    fontSize: 11,
  },
  deleteHistoryBtn: {
    padding: 6,
  },
  emptyHistoryBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: '#666666',
    fontSize: 12,
  },
  torrentSection: {
    marginBottom: 20,
  },
  torrentList: {
    gap: 8,
  },
  torrentRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 10,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#2F2F2F',
    gap: 12,
  },
  torrentThumbnail: {
    width: 44,
    height: 56,
    borderRadius: 5,
    backgroundColor: '#121212',
  },
  torrentRowTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  torrentRowMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  torrentDlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  torrentDlBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
