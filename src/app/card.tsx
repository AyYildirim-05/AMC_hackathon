import { useTranslation } from 'react-i18next';

import { TabScreen } from '@/components/tab-screen';

export default function CardScreen() {
  const { t } = useTranslation();

  return <TabScreen title={t('tabs.card')} placeholder={t('common.comingSoon')} />;
}
