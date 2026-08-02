import type { MetricGroup } from './types'

export const METRIC_GROUPS: MetricGroup[] = [
  {
    group: 'Top of Funnel',
    items: [
      { k: 'dials',   label: 'Dial',              short: 'Dial',      icon: 'phone',    color: '#FF4444' },
      { k: 'gk_conv', label: 'GK Conversation',  short: 'GK Conv',    icon: 'chat',     color: '#FF8C00' },
      { k: 'dm_conv', label: 'DM Conversation',  short: 'DM Conv',    icon: 'chat',     color: '#FFA500' },
      { k: 'vm',      label: 'Voicemail',        short: 'VM',         icon: 'voicemail',color: '#5A6685' },
    ],
  },
  {
    group: 'Middle of Funnel',
    items: [
      { k: 'disc', label: 'Discovery booked', short: 'Disc booked', icon: 'calendar', color: '#FFD700' },
      { k: 'demo', label: 'Demo booked',      short: 'Demo booked', icon: 'present',  color: '#7AA7F5' },
    ],
  },
  {
    group: 'Bottom of Funnel',
    items: [
      { k: 'onb',    label: 'Onboarding', short: 'Onboarding', icon: 'checklist', color: '#3DD6C3' },
      { k: 'closed', label: 'Closed won', short: 'Closed',     icon: 'trophy',    color: '#00E5A0' },
    ],
  },
]

export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.items)
export const KEY_METRICS = ['dials', 'dm_conv', 'disc', 'demo', 'onb', 'closed']
