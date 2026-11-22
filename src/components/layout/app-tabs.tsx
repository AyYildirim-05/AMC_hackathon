import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundElement}
      // The selected tab in the accent color (not the system blue), the others in neutral grey.
      tintColor={theme.tabIconSelected}
      iconColor={{ default: theme.tabIconDefault, selected: theme.tabIconSelected }}
      labelStyle={{
        default: { color: theme.tabIconDefault },
        selected: { color: theme.tabIconSelected },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.issues')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'exclamationmark.bubble', selected: 'exclamationmark.bubble.fill' }}
          md="report"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="card">
        <NativeTabs.Trigger.Label>{t('tabs.card')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label>{t('tabs.report')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          md="add_circle"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="district">
        <NativeTabs.Trigger.Label>{t('tabs.district')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'building.columns', selected: 'building.columns.fill' }}
          md="account_balance"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
