import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FollowSuggestions } from '@/components/follow-suggestions';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';

type Kind = 'organization' | 'person';

export default function SuggestionsScreen() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind>('organization');

  return (
    <Screen hasHeader>
      <SegmentedControl
        options={[
          { value: 'organization', label: t('suggestions.organizations') },
          { value: 'person', label: t('suggestions.people') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <FollowSuggestions key={kind} kind={kind} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('suggestions.hint')}
      </ThemedText>
    </Screen>
  );
}
