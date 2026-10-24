import React from "react";

import { useT } from "@/i18n";
import { Button, type ButtonSize } from "@/components/ui/Button";
import {
  useFollows,
  type FollowedCompany,
  type FollowedPerson,
  type FollowKind,
} from "@/store/follows-store";

export function FollowPersonButton({
  person,
  size = "md",
}: {
  person: FollowedPerson;
  size?: ButtonSize;
}) {
  const t = useT();
  const following = useFollows((state) => state.people.some((entry) => entry.id === person.id));
  const toggle = useFollows((state) => state.togglePerson);
  return (
    <Button
      label={following ? t("Following") : t("Follow")}
      icon={following ? "checkmark" : "add"}
      variant={following ? "primary" : "secondary"}
      size={size}
      onPress={() => toggle(person)}
    />
  );
}

export function FollowCompanyButton({
  company,
  size = "md",
}: {
  company: FollowedCompany;
  size?: ButtonSize;
}) {
  const t = useT();
  const following = useFollows((state) =>
    state.companies.some((entry) => entry.id === company.id && entry.kind === company.kind),
  );
  const toggle = useFollows((state) => state.toggleCompany);
  return (
    <Button
      label={following ? t("Following") : t("Follow")}
      icon={following ? "checkmark" : "add"}
      variant={following ? "primary" : "secondary"}
      size={size}
      onPress={() => toggle(company)}
    />
  );
}

export function companyKindLabel(kind: FollowKind, t: (key: string) => string): string {
  return kind === "network" ? t("Network") : t("Studio");
}
