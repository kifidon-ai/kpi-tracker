import type { MetricGroup } from './types'

export const METRIC_GROUPS: MetricGroup[] = [
  {
    group: 'Outreach',
    items: [
      { k: 'dials', label: 'Dial',         short: 'Dial',     icon: 'phone',    color: '#FF4444' },
      { k: 'conv',  label: 'Conversation', short: 'Conv',     icon: 'chat',     color: '#FF8C00' },
      { k: 'vm',    label: 'Voicemail',    short: 'VM',       icon: 'voicemail',color: '#5A6685' },
    ],
  },
  {
    group: 'Meetings booked',
    items: [
      { k: 'disc', label: 'Discovery booked', short: 'Disc booked', icon: 'calendar', color: '#FFD700' },
      { k: 'demo', label: 'Demo booked',      short: 'Demo booked', icon: 'present',  color: '#00E5A0' },
    ],
  },
  {
    group: 'Meetings attended',
    items: [
      { k: 'disc_att', label: 'Discovery attended', short: 'Disc attended', icon: 'check', color: '#F2A300' },
      { k: 'demo_att', label: 'Demo attended',      short: 'Demo attended', icon: 'check', color: '#E0357F' },
    ],
  },
  {
    group: 'Rescheduled / lost',
    items: [
      { k: 'disc_resch', label: 'Discovery rescheduled', short: 'Disc resch', icon: 'calendar', color: '#3B82F6' },
      { k: 'demo_resch', label: 'Demo rescheduled',      short: 'Demo resch', icon: 'calendar', color: '#7AA7F5' },
      { k: 'ghosted',    label: 'Cancelled / ghosted',   short: 'Ghosted',    icon: 'minus',    color: '#FF5468' },
      { k: 'closed',     label: 'Closed won',            short: 'Closed',     icon: 'trophy',   color: '#00E5A0' },
    ],
  },
]

export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.items)
export const KEY_METRICS = ['dials', 'conv', 'disc', 'demo', 'closed']
