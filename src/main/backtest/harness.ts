import type { RiotMatch, RiotTimeline } from '@shared/schemas/riot'
import type { BaselinePool } from '@shared/schemas/baselines'
import { loadBaselinePool } from '../engine/nextbuy'
import { recommend } from '../engine/recommend'
import { componentTree } from '../staticdata/itemgraph'
import type { StaticData } from '../staticdata/manager'
import { reconstructFrames } from './reconstruct'

export interface BacktestInput {
  match: RiotMatch
  timeline: RiotTimeline
  ownerPuuid: string
}

export interface AgreementBucket {
  comparisons: number
  top1Hits: number
  top3Hits: number
}

export interface Disagreement {
  matchId: string
  champion: string
  minute: number
  actual: number
  actualName: string
  top3: { itemId: number | null; itemName: string | null; score: number }[]
  topReasons: string[]
}

export interface BacktestReport {
  matches: number
  frames: number
  comparisons: number
  top1Rate: number
  top3Rate: number
  byChampion: Record<string, AgreementBucket & { top1Rate: number; top3Rate: number }>
  byPhase: Record<'early' | 'mid' | 'late', AgreementBucket & { top1Rate: number; top3Rate: number }>
  disagreements: Disagreement[]
  errors: { matchId: string; message: string }[]
}

function phaseOf(minute: number): 'early' | 'mid' | 'late' {
  if (minute < 14) return 'early'
  if (minute <= 25) return 'mid'
  return 'late'
}

/**
 * Agreement definition: a recommendation "hits" the actual purchase when it
 * points at the completed item itself OR at any component in its tree
 * (recommending B.F. Sword counts toward the Infinity Edge the player then
 * built — component vs completed handling).
 */
function matches(
  recommendedItemId: number | null,
  actual: number,
  staticData: StaticData
): boolean {
  if (recommendedItemId === null) return false
  if (recommendedItemId === actual) return true
  return componentTree(staticData.itemGraph, actual).includes(recommendedItemId)
}

export function runBacktest(
  inputs: BacktestInput[],
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool()
): BacktestReport {
  const overall: AgreementBucket = { comparisons: 0, top1Hits: 0, top3Hits: 0 }
  const byChampion = new Map<string, AgreementBucket>()
  const byPhase: Record<'early' | 'mid' | 'late', AgreementBucket> = {
    early: { comparisons: 0, top1Hits: 0, top3Hits: 0 },
    mid: { comparisons: 0, top1Hits: 0, top3Hits: 0 },
    late: { comparisons: 0, top1Hits: 0, top3Hits: 0 }
  }
  const disagreements: Disagreement[] = []
  const errors: { matchId: string; message: string }[] = []
  let frames = 0

  for (const input of inputs) {
    try {
      const reconstructed = reconstructFrames(
        input.match,
        input.timeline,
        input.ownerPuuid,
        staticData
      )
      frames += reconstructed.length
      const champion =
        input.match.info.participants.find((p) => p.puuid === input.ownerPuuid)
          ?.championName ?? 'unknown'

      for (const frame of reconstructed) {
        if (frame.actualNextPurchase === null) continue
        const recommendations = recommend(frame.state, staticData, pool)
        const withItems = recommendations.filter((rec) => rec.itemId !== null)
        if (withItems.length === 0) continue

        overall.comparisons += 1
        const champBucket = byChampion.get(champion) ?? {
          comparisons: 0,
          top1Hits: 0,
          top3Hits: 0
        }
        champBucket.comparisons += 1
        const phase = byPhase[phaseOf(frame.minute)]
        phase.comparisons += 1

        const top1 = matches(withItems[0]?.itemId ?? null, frame.actualNextPurchase, staticData)
        const top3 = withItems
          .slice(0, 3)
          .some((rec) => matches(rec.itemId, frame.actualNextPurchase ?? -1, staticData))
        if (top1) {
          overall.top1Hits += 1
          champBucket.top1Hits += 1
          phase.top1Hits += 1
        }
        if (top3) {
          overall.top3Hits += 1
          champBucket.top3Hits += 1
          phase.top3Hits += 1
        } else {
          disagreements.push({
            matchId: input.match.metadata.matchId,
            champion,
            minute: frame.minute,
            actual: frame.actualNextPurchase,
            actualName:
              staticData.itemGraph.nodes.get(frame.actualNextPurchase)?.name ??
              String(frame.actualNextPurchase),
            top3: withItems.slice(0, 3).map((rec) => ({
              itemId: rec.itemId,
              itemName: rec.itemName,
              score: rec.score
            })),
            topReasons: withItems[0]?.reasons ?? []
          })
        }
        byChampion.set(champion, champBucket)
      }
    } catch (error) {
      errors.push({
        matchId: input.match.metadata.matchId,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const rate = (bucket: AgreementBucket): { top1Rate: number; top3Rate: number } => ({
    top1Rate: bucket.comparisons > 0 ? bucket.top1Hits / bucket.comparisons : 0,
    top3Rate: bucket.comparisons > 0 ? bucket.top3Hits / bucket.comparisons : 0
  })

  return {
    matches: inputs.length,
    frames,
    comparisons: overall.comparisons,
    ...rate(overall),
    byChampion: Object.fromEntries(
      [...byChampion.entries()].map(([champion, bucket]) => [
        champion,
        { ...bucket, ...rate(bucket) }
      ])
    ),
    byPhase: {
      early: { ...byPhase.early, ...rate(byPhase.early) },
      mid: { ...byPhase.mid, ...rate(byPhase.mid) },
      late: { ...byPhase.late, ...rate(byPhase.late) }
    },
    disagreements: disagreements.slice(0, 25),
    errors
  }
}
