/** Browser Tool plugin: whole-call composition and keyed atomic Tool views. */
export { apply, inject } from './apply.ts'
export type {
  StartedToolCallViewProps, ToolCallCommonProps, ToolCallOwnerProps, ToolCallPhaseProps, ToolCallRowActionOwnerProps,
  ToolCallViewProps,
  ToolHostInfoInjected, ToolTreeProps, UserQuestionPanels, UserQuestionRecord,
} from './contract/slots.ts'
export type { ToolRowState } from './tool/models/tool-call-model.ts'
