import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/theme";
import { activateHouseholdProfile, createHouseholdProfile } from "@/lib/household/switch";
import { useProfiles } from "@/store/profiles-store";

export default function ProfilesScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const profiles = useProfiles((state) => state.profiles);
  const activeId = useProfiles((state) => state.activeId);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen reserveBottomNav>
      <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t("Household profiles")}
        </Text>
        <Text style={styles.copy}>
          {t("Each person on this device gets their own watchlist and progress. Profiles stay on the device.")}
        </Text>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.card}>
            <Text style={[styles.cardTitle, { color: profile.color }]}>{profile.name}</Text>
            <Text style={styles.cardMeta}>{profile.id === activeId ? t("Active") : ""}</Text>
            {profile.id === activeId ? null : (
              <Button
                label={t("Switch profile")}
                size="sm"
                variant="secondary"
                loading={busy}
                onPress={() => void run(() => activateHouseholdProfile(profile.id))}
              />
            )}
          </View>
        ))}
        <Text style={styles.label}>{t("Profile name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("Profile name")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Button
          label={t("Add profile")}
          onPress={() =>
            void run(async () => {
              await createHouseholdProfile(name);
              setName("");
            })
          }
          loading={busy}
          disabled={!name.trim()}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
