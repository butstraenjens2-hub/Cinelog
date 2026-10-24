import React, { useState } from "react";
import { TextInput, View } from "react-native";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import type { LibraryEntryRef } from "@/lib/cinelog/types";
import { useLists } from "@/store/lists-store";

export function AddToListButton({ item }: { item: LibraryEntryRef }) {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const lists = useLists((state) => state.lists);
  const createList = useLists((state) => state.createList);
  const toggleItem = useLists((state) => state.toggleItem);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <View style={styles.wrap}>
      <Button
        label={t("Add to a list")}
        icon="albums-outline"
        variant="secondary"
        size="lg"
        onPress={() => setOpen((value) => !value)}
      />
      {open ? (
        <View style={styles.panel}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("List name")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button
            label={t("Create list")}
            size="sm"
            disabled={!name.trim()}
            onPress={() => {
              createList(name, [item]);
              setName("");
            }}
          />
          {lists.map((list) => {
            const saved = list.items.some((entry) => entry.id === item.id);
            return (
              <Button
                key={list.id}
                label={saved ? t("In {{name}}", { name: list.name }) : list.name}
                icon={saved ? "checkmark" : "add"}
                variant={saved ? "primary" : "secondary"}
                size="sm"
                onPress={() => toggleItem(list.id, item)}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: SPACING.sm, alignItems: "flex-start" },
  panel: { gap: SPACING.sm, alignItems: "flex-start", alignSelf: "stretch" },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
}));
