export const browserShards = 8
export const workerShards = 2
export const runtimeLanes = ['unit', ...Array.from({ length: workerShards }, (_, index) => `worker-${index + 1}`)]
export const browserLanes = ['desktop', 'mobile'].flatMap(project => Array.from({ length: browserShards }, (_, index) => `${project}-${index + 1}`))
export const contractLanes = [...runtimeLanes, ...browserLanes]
