export interface DevSourceCoordinatorOptions {
  stopReplay: () => void
  stopScenario: () => void
  resetProcessor: () => void
}

/** Ensures exactly one debug source owns normalized game state at a time. */
export function createDevSourceCoordinator(options: DevSourceCoordinatorOptions): {
  switchSource: () => void
} {
  return {
    switchSource(): void {
      options.stopReplay()
      options.stopScenario()
      options.resetProcessor()
    }
  }
}
