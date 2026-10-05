import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { MediaThumb } from '@/components/media-thumb';
import { Button } from '@/components/ui/button';
import {
  ALBUM_PAGE_SIZE,
  SYSTEM_CONFIRMS_DELETE,
  deleteFromAlbum,
  ensureLibraryAccess,
  getLibraryAccess,
  hasFullLibraryAccess,
  hasLibraryAccess,
  installationTime,
  listAlbumItems,
  requestFullLibraryAccess,
} from '@/features/media/album';
import type { MediaItem } from '@/features/media/types';
import { updateSettings, useSettings } from '@/features/settings/store';
import { shareTo } from '@/features/share/share';
import { errorCode, errorMessage } from '@/lib/errors';
import { plural } from '@/lib/format';
import { putTransfer } from '@/lib/transfer';

type Status = 'loading' | 'ready' | 'denied';

const COLUMNS = 3;

function AccessHint({ onAllow }: { onAllow: () => void }) {
  return (
    <View className="items-center gap-3 px-8 py-6">
      <Text className="text-center text-sm text-muted">
        To show items saved before the app was reinstalled, allow access to photos and videos.
      </Text>
      <Button size="sm" variant="secondary" label="Allow access" onPress={onAllow} />
    </View>
  );
}

export default function MediaScreen() {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fullAccess, setFullAccess] = useState(true);
  const { mediaAccessAnsweredFor } = useSettings();
  const showAccessHint = !fullAccess && mediaAccessAnsweredFor !== installationTime();
  // URIs in the order they were tapped, which is the order they are shared in.
  const [selected, setSelected] = useState<string[]>([]);
  // How many items to show. It grows by a page as the list scrolls and stays the same when the
  // tab reloads, so the selection survives.
  const wantedCount = useRef(ALBUM_PAGE_SIZE);
  const pageRequested = useRef(false);
  // Each load gets a new number, so only the newest one updates the screen.
  const generation = useRef(0);
  // A quick second tap on Allow access would queue a second permission dialog.
  const askingAccess = useRef(false);
  // On Android 11 and later a quick second tap on Delete would open a second system dialog.
  const deleting = useRef(false);

  const load = useCallback(async (askForAccess = true) => {
    generation.current += 1;
    const request = generation.current;
    try {
      const allowed = askForAccess ? await ensureLibraryAccess() : await hasLibraryAccess();
      if (!allowed) {
        if (request === generation.current) {
          setStatus('denied');
        }
        return;
      }
      const count = wantedCount.current;
      const [albumItems, allItemsVisible] = await Promise.all([
        listAlbumItems(0, count),
        hasFullLibraryAccess(),
      ]);
      if (request !== generation.current) {
        return;
      }
      setItems(albumItems);
      setHasMore(albumItems.length === count);
      setFullAccess(allItemsVisible);
      setSelected((current) =>
        current.filter((uri) => albumItems.some((item) => item.uri === uri))
      );
      setStatus('ready');
    } catch (error) {
      if (request === generation.current) {
        Alert.alert('Could not open the album', errorMessage(error));
        setStatus('ready');
      }
    } finally {
      if (request === generation.current) {
        pageRequested.current = false;
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Access and the album can change in other apps, such as Android's settings or the gallery,
      // so the tab refreshes when the app comes back. It only checks access then, because asking
      // opens Android's permission screen, which itself counts as leaving the app.
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          load(false);
        }
      });
      return () => subscription.remove();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Each page reloads the list from the top with room for one more page, so no page is ever
  // added to a list that changed in the meantime.
  const loadMore = () => {
    if (!hasMore || pageRequested.current) {
      return;
    }
    pageRequested.current = true;
    wantedCount.current += ALBUM_PAGE_SIZE;
    load();
  };

  const allowAccess = async () => {
    if (askingAccess.current) {
      return;
    }
    askingAccess.current = true;
    try {
      // Once access has been refused for good, Android shows no dialog, so settings open instead.
      const current = await getLibraryAccess();
      if (!current.granted && !current.canAskAgain) {
        updateSettings({ mediaAccessAnsweredFor: installationTime() });
        Linking.openSettings();
        return;
      }
      await requestFullLibraryAccess();
      updateSettings({ mediaAccessAnsweredFor: installationTime() });
      await load();
    } catch (error) {
      Alert.alert('Could not open the album', errorMessage(error));
    } finally {
      askingAccess.current = false;
    }
  };

  const toggle = (uri: string) =>
    setSelected((current) =>
      current.includes(uri) ? current.filter((value) => value !== uri) : [...current, uri]
    );

  const chosen = selected
    .map((uri) => items.find((item) => item.uri === uri))
    .filter((item): item is MediaItem => item !== undefined);
  const single = chosen.length === 1 ? chosen[0] : null;

  const edit = () => {
    if (!single) {
      return;
    }
    const pathname = single.kind === 'video' ? '/video-editor' : '/image-editor';
    router.push({ pathname, params: { transfer: putTransfer([single]) } });
  };

  const deleteChosen = async () => {
    if (deleting.current) {
      return;
    }
    deleting.current = true;
    try {
      await deleteFromAlbum(chosen);
      setSelected([]);
      await load();
    } catch (error) {
      // Tapping Cancel in Android's own confirmation leaves everything as it was.
      if (SYSTEM_CONFIRMS_DELETE && errorCode(error) === 'ERR_PERMISSIONS') {
        return;
      }
      Alert.alert('Could not delete', errorMessage(error));
    } finally {
      deleting.current = false;
    }
  };

  const remove = () => {
    if (SYSTEM_CONFIRMS_DELETE) {
      deleteChosen();
      return;
    }
    Alert.alert(
      `Delete ${plural(chosen.length, 'item')}?`,
      `${chosen.length === 1 ? 'It' : 'They'} will be removed from this phone. Anything already shared is not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteChosen },
      ]
    );
  };

  if (status === 'denied') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
        <Text className="text-center text-lg font-semibold text-foreground">
          Photo and video access needed
        </Text>
        <Text className="text-center text-base text-muted">
          Allow access so the app can show the School Admin album.
        </Text>
        <Button label="Try again" onPress={() => load()} />
        <Button variant="ghost" label="Open settings" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  if (status === 'ready' && items.length === 0) {
    return (
      <EmptyState
        title="No saved items"
        message="Photos, videos and notice cards you save appear here.">
        {showAccessHint ? <AccessHint onAllow={allowAccess} /> : null}
      </EmptyState>
    );
  }

  const size = Math.floor(width / COLUMNS);
  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.uri}
        numColumns={COLUMNS}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={showAccessHint ? <AccessHint onAllow={allowAccess} /> : null}
        contentContainerStyle={{ paddingBottom: chosen.length > 0 ? 180 : 16 }}
        renderItem={({ item }) => {
          const position = selected.indexOf(item.uri);
          return (
            <MediaThumb
              item={item}
              size={size}
              selectionNumber={position >= 0 ? position + 1 : undefined}
              onPress={() => toggle(item.uri)}
            />
          );
        }}
      />
      {chosen.length > 0 ? (
        <View className="absolute bottom-0 left-0 right-0 gap-3 border-t border-border bg-background p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">
              {plural(chosen.length, 'item')} selected
            </Text>
            <Button size="sm" variant="ghost" label="Clear" onPress={() => setSelected([])} />
          </View>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="whatsapp"
              icon="logo-whatsapp"
              label="WhatsApp"
              onPress={() => shareTo('whatsapp', chosen)}
            />
            <Button
              className="flex-1"
              variant="facebook"
              icon="logo-facebook"
              label="Facebook"
              onPress={() => shareTo('facebook', chosen)}
            />
            {single?.kind === 'video' ? (
              <Button
                size="icon"
                variant="youtube"
                icon="logo-youtube"
                accessibilityLabel="YouTube"
                onPress={() => shareTo('youtube', chosen)}
              />
            ) : null}
          </View>
          <View className="flex-row gap-2">
            {single ? (
              <Button
                className="flex-1"
                variant="secondary"
                icon="create-outline"
                label="Edit"
                onPress={edit}
              />
            ) : null}
            <Button
              className="flex-1"
              variant="secondary"
              icon="trash-outline"
              label="Delete"
              onPress={remove}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
