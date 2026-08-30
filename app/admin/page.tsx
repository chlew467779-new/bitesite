/* bitesite/app/admin/page.tsx */
'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { AuthProvider, useAuth } from './components/auth-context';
import LoginForm from './login-form';
import AdminShell from './components/admin-shell';
import StatCards from './components/stat-cards';
import TrendChart from './components/trend-chart';
import MerchantTable from './components/merchant-table';
import DeviceChart from './components/device-chart';
import LocationChart from './components/location-chart';
import ReferrerChart from './components/referrer-chart';
import SearchKeywordsTable from './components/search-keywords-table';
import EventsChart from './components/events-chart';
import StoriesChart from './components/stories-chart';
import MapStats from './components/map-stats';
import HourlyChart from './components/hourly-chart';
import RealtimeBadge from './components/realtime-badge';
import ExportButton from './components/export-button';
import DateRangePicker from './components/date-range-picker';
import { SettingsPanel } from './components/settings-panel';

const helpTexts: Record<string, string> = {
  overview:
    '总览页面展示网站核心数据。Total Views = 所有页面被打开的总次数；Unique Visitors = 去重后的独立访客数；Events = 用户触发的事件总数（如点击 WhatsApp、分享等）；Merchants = 有浏览记录的商家数量。Traffic Trend 展示每日流量变化，Device Distribution 显示访客设备类型，Merchant Performance 列出各商家浏览排名。',
  trends:
    '流量趋势展示选定时间范围内的每日浏览量变化。帮助你识别流量高峰和低谷，评估营销活动效果。如果某天流量突然上升，可能是社交媒体分享或搜索引擎收录带来的。',
  merchants:
    '商家表现列出所有商家的浏览数据排名。包括每家商家的总浏览量、今日浏览量和平均停留时间。数据帮助你了解哪家餐厅最受关注，可作为向商家展示价值的依据。',
  devices:
    '设备分析展示访客使用的设备类型分布（桌面电脑、手机、平板）。如果移动端比例很高，说明用户多在手机上浏览，商家页面需要确保移动端体验良好。',
  locations:
    '地理位置显示访客的地理分布，包括城市和国家的访问排名。帮助你了解用户主要来自哪里。Kuala Lumpur 占比高是正常的，如果出现其他城市，说明有外地或国际访客。',
  referrers:
    '流量来源展示访客从哪些渠道来到网站。Direct = 直接输入网址或书签；Google/Bing = 搜索引擎；Social = 社交媒体；Other = 无法识别的来源。高比例的 Direct 说明品牌认知度不错。',
  search:
    '搜索关键词记录用户在首页搜索框输入的内容。帮助你了解用户想找什么类型的餐厅（如 "cafe"、"japanese"、"klcc" 等），可用于优化首页推荐或引导商家入驻。',
  events:
    '事件分析追踪用户的关键行为。包括：page_view（页面浏览）、whatsapp_click（点击 WhatsApp 联系商家）、share（分享页面）、booking_submit（提交预订）、map_marker_click（点击地图标记）、story_to_merchant（从 Story 文章跳转到商家）。',
  'stories-analytics':
    'Stories 表现展示每篇文章的浏览量和转化率。Views = 文章被阅读的次数；Conversions = 读者点击 "View their full menu" 跳转到商家页面的次数。Conversion Rate 越高，说明文章引流效果越好。',
  map:
    '地图页面统计展示 Our Partner 地图页面的访问数据。包括地图页面总浏览量和地图标记点击次数。标记点击高说明用户对地理位置和附近餐厅感兴趣。',
  hourly:
    '高峰时段展示一天 24 小时的访问分布。帮助你了解用户最活跃的时段。如果晚上 8-10 点是高峰，说明用户多在饭后浏览，可以建议商家在这个时段更新菜单或发布优惠。',
  export:
    '导出数据允许你将分析数据下载为 CSV 文件。包含日期、商家、页面类型、设备、国家、城市、事件类型等字段。方便离线分析或制作月度报告给商家看。',
  settings:
    '设置页面允许你修改网站全局配置，无需改代码。包括网站标题、SEO 描述、联系信息、WhatsApp 预订号码等。修改后自动保存到数据库，后续将接入网站各处。',
};

function TabHeader({
  title,
  tabKey,
  activeHelp,
  setActiveHelp,
}: {
  title: string;
  tabKey: string;
  activeHelp: string | null;
  setActiveHelp: (k: string | null) => void;
}) {
  const isOpen = activeHelp === tabKey;
  return (
    <div className="flex items-start gap-2 relative">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <button
        onClick={() => setActiveHelp(isOpen ? null : tabKey)}
        className="mt-0.5 text-slate-400 hover:text-amber-400 transition-colors"
        title="功能说明"
      >
        <HelpCircle size={18} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-8 z-50 w-80 rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-relaxed text-slate-300">
              {helpTexts[tabKey]}
            </p>
            <button
              onClick={() => setActiveHelp(null)}
              className="flex-shrink-0 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');
  const [activeHelp, setActiveHelp] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <TabHeader
                title="Dashboard Overview"
                tabKey="overview"
                activeHelp={activeHelp}
                setActiveHelp={setActiveHelp}
              />
              <div className="flex items-center gap-3">
                <RealtimeBadge />
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            </div>
            <StatCards range={dateRange} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TrendChart range={dateRange} />
              </div>
              <div>
                <DeviceChart range={dateRange} />
              </div>
            </div>
            <MerchantTable range={dateRange} />
          </div>
        );
      case 'trends':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Traffic Trends"
              tabKey="trends"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <TrendChart range={dateRange} fullWidth />
          </div>
        );
      case 'merchants':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Merchant Performance"
              tabKey="merchants"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <MerchantTable range={dateRange} />
          </div>
        );
      case 'devices':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Device Analytics"
              tabKey="devices"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DeviceChart range={dateRange} />
            </div>
          </div>
        );
      case 'locations':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Location Analytics"
              tabKey="locations"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <LocationChart range={dateRange} />
          </div>
        );
      case 'referrers':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Traffic Sources"
              tabKey="referrers"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <ReferrerChart range={dateRange} />
          </div>
        );
      case 'search':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Search Keywords"
              tabKey="search"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <SearchKeywordsTable range={dateRange} />
          </div>
        );
      case 'events':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Event Analytics"
              tabKey="events"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <EventsChart range={dateRange} />
          </div>
        );
      case 'stories-analytics':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Stories Performance"
              tabKey="stories"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <StoriesChart range={dateRange} />
          </div>
        );
      case 'map':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Map Page Stats"
              tabKey="map"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <MapStats range={dateRange} />
          </div>
        );
      case 'hourly':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Peak Hours"
              tabKey="hourly"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <HourlyChart range={dateRange} />
          </div>
        );
      case 'export':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Export Data"
              tabKey="export"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <ExportButton range={dateRange} />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6">
            <TabHeader
              title="Settings"
              tabKey="settings"
              activeHelp={activeHelp}
              setActiveHelp={setActiveHelp}
            />
            <SettingsPanel />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
