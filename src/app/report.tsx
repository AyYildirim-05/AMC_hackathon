import { useTranslation } from 'react-i18next';

import { TabScreen } from '@/components/tab-screen';

export default function ReportScreen() {
  const { t } = useTranslation();

  return <TabScreen title={t('tabs.report')} placeholder={t('common.comingSoon')} />;
}
