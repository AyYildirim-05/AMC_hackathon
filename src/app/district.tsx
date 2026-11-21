import { useTranslation } from 'react-i18next';

import { TabScreen } from '@/components/tab-screen';

export default function DistrictScreen() {
  const { t } = useTranslation();

  return <TabScreen title={t('tabs.district')} placeholder={t('common.comingSoon')} />;
}
