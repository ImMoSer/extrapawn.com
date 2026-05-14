// src/entities/puzzle/model/types.ts

export interface TopInfoStat {
  icon?: string
  value: string | number
  label?: string
  color?: string
}

export interface TopInfoBadge {
  text: string
  type?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
  color?: string
  count?: number
}

export interface TopInfoDisplay {
  title: string
  mainValue?: string | number
  mainIcon?: string
  mainColor?: string
  badges: TopInfoBadge[]
  stats: TopInfoStat[]
  secondaryText?: string
  // FSD: Flags for purely visual effects driven by state
  isValueHidden?: boolean
  isPulsating?: boolean
  // Optional legacy field for specific CSS hooks if absolutely necessary
  customType?: string
  extra?: {
    category?: string
    isWaiting?: boolean
    [key: string]: unknown
  }
}
