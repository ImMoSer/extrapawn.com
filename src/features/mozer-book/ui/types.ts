import { type MozerBookMove, type MozerBookTheoryItem } from '@/entities/opening'

export interface MozerBookMoveExtended extends MozerBookMove {
  children: MozerBookTheoryItem[]
}

export interface TheoryItemWithChildren extends MozerBookMove {
  children: MozerBookTheoryItem[]
}
