import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Section } from '@/components/ui/section';
import { logoSource } from '@/features/overlays/assets';
import { chooseCustomLogo } from '@/features/settings/logo';
import type { WhatsAppChoice } from '@/features/settings/settings';
import { updateSettings, useSettings } from '@/features/settings/store';
import { isAppInstalled } from '@/features/share/share';
import { APPS, type AppInfo } from '@/features/share/targets';
import { errorCode, errorMessage } from '@/lib/errors';
import { SCHOOL } from '@/school/defaults';
import { ui } from '@/theme/colors';

const WHATSAPP_OPTIONS = [
  { value: 'business', label: APPS.whatsappBusiness.label },
  { value: 'personal', label: APPS.whatsapp.label },
] as const satisfies readonly { value: WhatsAppChoice; label: string }[];

// Checking for and downloading an update fail mostly when the phone is offline, and the updates
// library leaves the cause out of its message.
const UPDATE_SERVER_ERRORS = ['ERR_UPDATES_CHECK', 'ERR_UPDATES_FETCH'];

function InstallNote({ app, installed }: { app: AppInfo; installed: boolean | undefined }) {
  if (installed === undefined) {
    return null;
  }
  return (
    <View className="flex-row items-center gap-2">
      <Icon
        name={installed ? 'checkmark-circle' : 'alert-circle-outline'}
        size={18}
        color={installed ? ui.success : ui.danger}
      />
      <Text className="flex-1 text-sm text-muted">
        {installed
          ? `${app.label} is installed.`
          : `${app.label} is not installed. When sharing, the phone will ask which app to use.`}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const settings = useSettings();
  const [name, setName] = useState(settings.schoolName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setInstalled(
        Object.fromEntries(
          Object.values(APPS).map((app) => [app.packageName, isAppInstalled(app.packageName)])
        )
      );
    }, [])
  );

  const changed =
    name !== settings.schoolName || address !== settings.address || phone !== settings.phone;

  const saveDetails = () => {
    if (!name.trim()) {
      Alert.alert('School name required', 'Enter the school name before saving.');
      return;
    }
    const next = updateSettings({ schoolName: name, address, phone });
    setName(next.schoolName);
    setAddress(next.address);
    setPhone(next.phone);
    Alert.alert('Details saved', 'New notice cards will use these details.');
  };

  const resetDetails = () => {
    const next = updateSettings({
      schoolName: SCHOOL.name,
      address: SCHOOL.address,
      phone: SCHOOL.phone,
    });
    setName(next.schoolName);
    setAddress(next.address);
    setPhone(next.phone);
  };

  const pickLogo = async () => {
    try {
      const uri = await chooseCustomLogo();
      if (uri) {
        updateSettings({ logoUri: uri });
      }
    } catch (error) {
      Alert.alert('Could not use this image', errorMessage(error));
    }
  };

  const checkForUpdates = async () => {
    if (!Updates.isEnabled) {
      Alert.alert(
        'Updates unavailable',
        'Automatic updates are not available in this version of the app.'
      );
      return;
    }
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Up to date', 'You have the latest version.');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Restart the app to use the new version?', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart', onPress: () => Updates.reloadAsync() },
      ]);
    } catch (error) {
      const code = errorCode(error);
      Alert.alert(
        'Could not check for updates',
        code && UPDATE_SERVER_ERRORS.includes(code)
          ? 'Check the internet connection and try again.'
          : errorMessage(error)
      );
    } finally {
      setChecking(false);
    }
  };

  const whatsappApp = settings.whatsappApp === 'business' ? APPS.whatsappBusiness : APPS.whatsapp;

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-surface">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-10">
        <Card className="gap-4">
          <Section title="School details" hint="Shown on notice cards.">
            <Input value={name} onChangeText={setName} placeholder="School name" maxLength={60} />
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              multiline
              className="min-h-20"
              maxLength={160}
            />
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              maxLength={30}
            />
          </Section>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              icon="save-outline"
              label="Save details"
              disabled={!changed}
              onPress={saveDetails}
            />
            <Button variant="ghost" label="Reset" onPress={resetDetails} />
          </View>
        </Card>

        <Card className="gap-4">
          <Section title="Logo" hint="Used on notice cards, photos and videos.">
            <View className="flex-row items-center gap-4">
              <Image
                source={logoSource(settings.logoUri)}
                style={{ width: 72, height: 72 }}
                contentFit="contain"
              />
              <View className="flex-1 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon="image-outline"
                  label="Change logo"
                  onPress={pickLogo}
                />
                {settings.logoUri ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    label="Use default logo"
                    onPress={() => updateSettings({ logoUri: null })}
                  />
                ) : null}
              </View>
            </View>
          </Section>
        </Card>

        <Card className="gap-4">
          <Section title="Sharing apps" hint="Choose which WhatsApp app opens when you share.">
            <ChoiceChips
              options={WHATSAPP_OPTIONS}
              value={settings.whatsappApp}
              onChange={(whatsapp) => updateSettings({ whatsappApp: whatsapp })}
            />
            <InstallNote app={whatsappApp} installed={installed[whatsappApp.packageName]} />
          </Section>
          <InstallNote app={APPS.facebook} installed={installed[APPS.facebook.packageName]} />
          <InstallNote app={APPS.youtube} installed={installed[APPS.youtube.packageName]} />
        </Card>

        <Card className="gap-3">
          <Section title="About">
            <Text className="text-base text-foreground">
              Version {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
            <Button
              variant="secondary"
              icon="cloud-download-outline"
              label="Check for updates"
              loading={checking}
              onPress={checkForUpdates}
            />
          </Section>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
